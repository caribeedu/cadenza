"""WebSocket router mounting the hub's client-facing endpoint at ``/``.

The endpoint is intentionally mounted at the root path so existing
clients (Electron frontend, MuseScore plugin) can connect via
``ws://host:port`` without appending a path segment.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from cadenza_server.core import protocol
from cadenza_server.core.protocol import MessageType
from cadenza_server.features.hub import ClientConnection, Hub

log = logging.getLogger("cadenza.api.ws")


class _FastAPIWebSocketAdapter(ClientConnection):
    """Adapt a FastAPI :class:`WebSocket` to the hub's minimal contract."""

    def __init__(self, ws: WebSocket) -> None:
        self._ws = ws

    async def send_text(self, payload: str) -> None:
        await self._ws.send_text(payload)


def build_ws_router(hub: Hub) -> APIRouter:
    """Return a FastAPI router bound to the given ``hub`` instance."""
    router = APIRouter()

    @router.websocket("/")
    async def ws_endpoint(ws: WebSocket) -> None:
        await ws.accept()
        client = await hub.register(_FastAPIWebSocketAdapter(ws))
        try:
            while True:
                raw = await ws.receive_text()
                try:
                    msg = protocol.decode(raw)
                except (ValueError, UnicodeDecodeError) as exc:
                    await ws.send_text(
                        protocol.encode(
                            {"type": MessageType.ERROR, "error": str(exc)}
                        )
                    )
                    continue
                await hub.handle_message(client, msg)
        except WebSocketDisconnect:
            pass
        finally:
            hub.unregister(client)

    return router
