"""Hub feature: transport-agnostic service that owns session state.

The :class:`Hub` aggregates the score, the validator, the MIDI pump, and
the set of connected clients. Transport adapters (``features.api.*``)
instantiate a :class:`ClientConnection` implementation and hand it to the
hub; the hub never imports FastAPI, WebSocket, or HTTP primitives.
"""

from cadenza_server.features.hub.service import (
    ClientConnection,
    Hub,
    HubError,
)
from cadenza_server.features.hub.state import (
    Client,
    ClientRole,
    HubState,
)

__all__ = [
    "Client",
    "ClientConnection",
    "ClientRole",
    "Hub",
    "HubError",
    "HubState",
]
