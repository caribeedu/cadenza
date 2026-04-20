"""Unit tests for the lightweight HTTP ingest used by the MuseScore plugin."""

from __future__ import annotations

import asyncio
import json
import socket

import pytest

from cadenza_server.http_ingest import MAX_BODY_BYTES, serve_ingest


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


async def _raw_request(port: int, request: bytes) -> bytes:
    reader, writer = await asyncio.open_connection("127.0.0.1", port)
    writer.write(request)
    await writer.drain()
    data = await reader.read()
    writer.close()
    await writer.wait_closed()
    return data


def _status_line(response: bytes) -> bytes:
    return response.split(b"\r\n", 1)[0]


def _body(response: bytes) -> dict:
    _, _, body = response.partition(b"\r\n\r\n")
    return json.loads(body.decode("utf-8")) if body else {}


async def _run_server(handler, coro):
    port = _free_port()
    server = await serve_ingest("127.0.0.1", port, handler)
    try:
        return await coro(port)
    finally:
        server.close()
        await server.wait_closed()


@pytest.mark.asyncio
async def test_valid_post_invokes_handler_and_returns_200() -> None:
    seen: list[dict] = []

    async def handler(payload: dict) -> dict:
        seen.append(payload)
        return {"ok": True, "seen": len(seen)}

    async def scenario(port: int) -> None:
        body = json.dumps({"type": "score", "bpm": 120, "notes": []}).encode("utf-8")
        response = await _raw_request(
            port,
            b"POST /score HTTP/1.1\r\n"
            b"Host: localhost\r\n"
            b"Content-Type: application/json\r\n"
            b"Content-Length: " + str(len(body)).encode("ascii") + b"\r\n\r\n"
            + body,
        )
        assert _status_line(response) == b"HTTP/1.1 200 OK"
        assert _body(response) == {"ok": True, "seen": 1}
        assert seen == [{"type": "score", "bpm": 120, "notes": []}]

    await _run_server(handler, scenario)


@pytest.mark.asyncio
async def test_handler_value_error_maps_to_400() -> None:
    async def handler(payload: dict) -> dict:
        raise ValueError("no notes in payload")

    async def scenario(port: int) -> None:
        body = b"{}"
        response = await _raw_request(
            port,
            b"POST /score HTTP/1.1\r\nContent-Length: 2\r\n\r\n" + body,
        )
        assert _status_line(response) == b"HTTP/1.1 400 Bad Request"
        assert _body(response) == {"error": "no notes in payload"}

    await _run_server(handler, scenario)


@pytest.mark.asyncio
async def test_method_not_allowed_returns_405_with_allow_header() -> None:
    async def handler(payload: dict) -> dict:  # pragma: no cover - shouldn't run
        raise AssertionError("handler must not be called for GET")

    async def scenario(port: int) -> None:
        response = await _raw_request(
            port,
            b"GET /score HTTP/1.1\r\nHost: localhost\r\n\r\n",
        )
        assert _status_line(response) == b"HTTP/1.1 405 Method Not Allowed"
        assert b"Allow: POST, OPTIONS" in response

    await _run_server(handler, scenario)


@pytest.mark.asyncio
async def test_unknown_path_returns_404() -> None:
    async def handler(payload: dict) -> dict:  # pragma: no cover
        raise AssertionError("handler must not be called for /nope")

    async def scenario(port: int) -> None:
        response = await _raw_request(
            port,
            b"POST /nope HTTP/1.1\r\nContent-Length: 2\r\n\r\n{}",
        )
        assert _status_line(response) == b"HTTP/1.1 404 Not Found"

    await _run_server(handler, scenario)


@pytest.mark.asyncio
async def test_invalid_json_returns_400() -> None:
    async def handler(payload: dict) -> dict:  # pragma: no cover
        raise AssertionError("handler must not be called for broken JSON")

    async def scenario(port: int) -> None:
        body = b"not json"
        response = await _raw_request(
            port,
            b"POST /score HTTP/1.1\r\nContent-Length: "
            + str(len(body)).encode("ascii")
            + b"\r\n\r\n"
            + body,
        )
        assert _status_line(response) == b"HTTP/1.1 400 Bad Request"
        assert "invalid JSON" in _body(response)["error"]

    await _run_server(handler, scenario)


@pytest.mark.asyncio
async def test_oversized_body_rejected_without_invoking_handler() -> None:
    async def handler(payload: dict) -> dict:  # pragma: no cover
        raise AssertionError("handler must not run for oversized bodies")

    async def scenario(port: int) -> None:
        response = await _raw_request(
            port,
            b"POST /score HTTP/1.1\r\nContent-Length: "
            + str(MAX_BODY_BYTES + 1).encode("ascii")
            + b"\r\n\r\n",
        )
        assert _status_line(response) == b"HTTP/1.1 413 Payload Too Large"

    await _run_server(handler, scenario)
