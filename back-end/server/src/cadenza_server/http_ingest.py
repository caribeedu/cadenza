"""Minimal asyncio HTTP ingest endpoint used by the MuseScore plugin.

MuseScore 4 on Windows and macOS does not ship the ``Qt.WebSockets`` QML
module (see TECH-DEBTS TD-05), so the plugin can only talk to us over
HTTP via ``XMLHttpRequest`` (which is always available to QML).

This module implements just enough of HTTP/1.1 to accept a single
``POST /score`` request carrying a JSON body and forward it to a
handler coroutine. It intentionally does **not** introduce a new
third-party dependency: the whole thing is ~100 lines on top of
``asyncio.start_server``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Awaitable, Callable, Optional

log = logging.getLogger("cadenza.http")

ScoreHandler = Callable[[dict], Awaitable[dict]]
"""Async callback invoked with the parsed JSON payload.

Must return a JSON-serialisable response dict. Raise ``ValueError`` for
client-side problems (mapped to HTTP 400); any other exception is
mapped to HTTP 500.
"""

DEFAULT_PORT = 8766
MAX_BODY_BYTES = 4 * 1024 * 1024  # 4 MiB cap: generous for large scores, still safe.
SCORE_PATHS = ("/score", "/score/")


async def serve_ingest(host: str, port: int, handler: ScoreHandler) -> asyncio.Server:
    """Bind and start the HTTP ingest. Caller owns the returned server."""

    server = await asyncio.start_server(_make_client_cb(handler), host, port)
    sockets = server.sockets or ()
    for sock in sockets:
        log.info("Cadenza HTTP ingest listening on http://%s:%d", *sock.getsockname()[:2])
    return server


def _make_client_cb(handler: ScoreHandler):
    async def cb(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        try:
            await _handle(reader, writer, handler)
        except (ConnectionResetError, asyncio.IncompleteReadError):
            pass
        except Exception:  # pragma: no cover - defensive
            log.exception("HTTP ingest handler crashed")
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:  # pragma: no cover - socket already gone
                pass

    return cb


async def _handle(
    reader: asyncio.StreamReader,
    writer: asyncio.StreamWriter,
    handler: ScoreHandler,
) -> None:
    request_line = await reader.readline()
    if not request_line:
        return
    parts = request_line.decode("latin-1").rstrip("\r\n").split(" ")
    if len(parts) != 3:
        await _write_response(writer, 400, {"error": "malformed request line"})
        return
    method, path, _version = parts

    headers: dict[str, str] = {}
    while True:
        line = await reader.readline()
        if not line or line in (b"\r\n", b"\n"):
            break
        key, _, value = line.decode("latin-1").partition(":")
        if key:
            headers[key.strip().lower()] = value.strip()

    # CORS pre-flight: QML's XHR does not send these, but a browser-based
    # tester might. Cheap to support.
    if method == "OPTIONS":
        await _write_response(
            writer,
            204,
            body=None,
            extra_headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        )
        return

    if method != "POST":
        await _write_response(
            writer,
            405,
            {"error": f"method {method} not allowed"},
            extra_headers={"Allow": "POST, OPTIONS"},
        )
        return

    if path not in SCORE_PATHS:
        await _write_response(writer, 404, {"error": f"no handler for {path}"})
        return

    try:
        length = int(headers.get("content-length", "0"))
    except ValueError:
        await _write_response(writer, 400, {"error": "invalid Content-Length"})
        return
    if length <= 0:
        await _write_response(writer, 411, {"error": "Content-Length is required"})
        return
    if length > MAX_BODY_BYTES:
        await _write_response(
            writer,
            413,
            {"error": f"payload too large (>{MAX_BODY_BYTES} bytes)"},
        )
        return

    try:
        body = await reader.readexactly(length)
    except asyncio.IncompleteReadError:
        await _write_response(writer, 400, {"error": "client closed before body completed"})
        return

    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        await _write_response(writer, 400, {"error": f"invalid JSON: {exc}"})
        return
    if not isinstance(payload, dict):
        await _write_response(writer, 400, {"error": "JSON body must be an object"})
        return

    try:
        response = await handler(payload)
    except ValueError as exc:
        log.warning("Rejected score payload: %s", exc)
        await _write_response(writer, 400, {"error": str(exc)})
        return
    except Exception as exc:  # pragma: no cover - defensive
        log.exception("Score handler raised")
        await _write_response(writer, 500, {"error": f"internal error: {exc}"})
        return

    await _write_response(writer, 200, response if response is not None else {"ok": True})


async def _write_response(
    writer: asyncio.StreamWriter,
    status: int,
    body: Optional[dict],
    *,
    extra_headers: Optional[dict[str, str]] = None,
) -> None:
    status_text = _STATUS_TEXT.get(status, "OK")
    body_bytes = b"" if body is None else json.dumps(body).encode("utf-8")
    header_lines = [
        f"HTTP/1.1 {status} {status_text}",
        f"Content-Length: {len(body_bytes)}",
        "Connection: close",
    ]
    if body is not None:
        header_lines.append("Content-Type: application/json")
    if extra_headers:
        header_lines.extend(f"{k}: {v}" for k, v in extra_headers.items())
    head = ("\r\n".join(header_lines) + "\r\n\r\n").encode("latin-1")
    writer.write(head + body_bytes)
    try:
        await writer.drain()
    except ConnectionResetError:  # pragma: no cover - client already hung up
        pass


_STATUS_TEXT = {
    200: "OK",
    204: "No Content",
    400: "Bad Request",
    404: "Not Found",
    405: "Method Not Allowed",
    411: "Length Required",
    413: "Payload Too Large",
    500: "Internal Server Error",
}
