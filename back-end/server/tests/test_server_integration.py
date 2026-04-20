"""Integration smoke test: boot the server and walk the full handshake."""

from __future__ import annotations

import asyncio
import json
import socket

import pytest
from websockets.asyncio.client import connect

from cadenza_server.server import CadenzaServer


def _free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _free_ports(n: int) -> list[int]:
    """Reserve ``n`` distinct ephemeral ports.

    We hold all sockets open until we've bound every port, otherwise the
    kernel could hand out the same port twice when two tests run in
    parallel or when the first returned port is reused before we bind
    the second.
    """

    socks = [socket.socket(socket.AF_INET, socket.SOCK_STREAM) for _ in range(n)]
    try:
        for s in socks:
            s.bind(("127.0.0.1", 0))
        return [s.getsockname()[1] for s in socks]
    finally:
        for s in socks:
            s.close()


async def _recv_until(ws, predicate, timeout: float = 2.0):
    async def _inner():
        while True:
            raw = await ws.recv()
            msg = json.loads(raw)
            if predicate(msg):
                return msg

    return await asyncio.wait_for(_inner(), timeout=timeout)


@pytest.mark.asyncio
async def test_plugin_score_reaches_frontend_as_timeline() -> None:
    ws_port, http_port = _free_ports(2)
    server = CadenzaServer(host="127.0.0.1", port=ws_port, http_port=http_port)
    task = asyncio.create_task(server.run())
    # Give the server a moment to bind.
    await asyncio.sleep(0.2)

    try:
        uri = f"ws://127.0.0.1:{ws_port}"
        async with connect(uri) as frontend, connect(uri) as plugin:
            await frontend.send(json.dumps({"type": "hello", "role": "frontend"}))
            await plugin.send(json.dumps({"type": "hello", "role": "plugin"}))

            await plugin.send(
                json.dumps(
                    {
                        "type": "score",
                        "bpm": 120,
                        "notes": [
                            {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                            {"pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0},
                        ],
                    }
                )
            )

            timeline = await _recv_until(
                frontend, lambda m: m.get("type") == "score_timeline"
            )
            assert timeline["bpm"] == 120
            assert len(timeline["notes"]) == 2
            assert timeline["notes"][0]["pitch"] == 60
            assert timeline["notes"][1]["start_ms"] == pytest.approx(500.0)
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_plugin_score_via_http_reaches_frontend_as_timeline() -> None:
    """Regression for TD-05: the MuseScore plugin posts scores over HTTP
    because the Qt.WebSockets QML module is not available on Windows/macOS
    builds of MuseScore 4. The HTTP ingest must feed the same hub pipeline
    that the WebSocket path does."""

    ws_port, http_port = _free_ports(2)
    server = CadenzaServer(host="127.0.0.1", port=ws_port, http_port=http_port)
    task = asyncio.create_task(server.run())
    await asyncio.sleep(0.2)

    try:
        uri = f"ws://127.0.0.1:{ws_port}"
        async with connect(uri) as frontend:
            await frontend.send(json.dumps({"type": "hello", "role": "frontend"}))

            body = json.dumps(
                {
                    "type": "score",
                    "bpm": 120,
                    "notes": [
                        {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                        {"pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0},
                    ],
                }
            ).encode("utf-8")

            reader, writer = await asyncio.open_connection("127.0.0.1", http_port)
            request = (
                b"POST /score HTTP/1.1\r\n"
                b"Host: 127.0.0.1\r\n"
                b"Content-Type: application/json\r\n"
                b"Content-Length: " + str(len(body)).encode("ascii") + b"\r\n"
                b"Connection: close\r\n\r\n"
                + body
            )
            writer.write(request)
            await writer.drain()
            raw_response = await reader.read()
            writer.close()
            await writer.wait_closed()

            assert raw_response.startswith(b"HTTP/1.1 200"), raw_response[:64]
            _, _, raw_body = raw_response.partition(b"\r\n\r\n")
            body_json = json.loads(raw_body.decode("utf-8"))
            assert body_json == {"ok": True, "notes": 2, "bpm": 120.0}

            timeline = await _recv_until(
                frontend, lambda m: m.get("type") == "score_timeline"
            )
            assert timeline["bpm"] == 120
            assert len(timeline["notes"]) == 2
            assert timeline["notes"][0]["pitch"] == 60
            assert timeline["notes"][1]["start_ms"] == pytest.approx(500.0)
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
