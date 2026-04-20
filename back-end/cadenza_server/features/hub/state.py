"""Hub state dataclasses.

Kept in their own module so the service can be imported with zero
side effects in tests that only want to inspect/mutate state.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import TYPE_CHECKING

from cadenza_server.core.validator import DEFAULT_TOLERANCE_MS, Validator
from cadenza_server.features.midi import DEFAULT_PLAYBACK_SPEED

if TYPE_CHECKING:
    from cadenza_server.core.score import Score
    from cadenza_server.features.hub.service import ClientConnection


class ClientRole(StrEnum):
    """Known client roles as announced via the ``hello`` message.

    Unknown or missing role strings are normalised to ``UNKNOWN`` rather
    than raising — the hub tolerates ad-hoc testers that don't announce
    themselves.
    """

    PLUGIN = "plugin"
    FRONTEND = "frontend"
    UNKNOWN = "unknown"

    @classmethod
    def parse(cls, raw: object) -> ClientRole:
        if isinstance(raw, str):
            try:
                return cls(raw)
            except ValueError:
                return cls.UNKNOWN
        return cls.UNKNOWN


@dataclass(eq=False)
class Client:
    """Per-connection state.

    Identity-based equality/hash (``eq=False``) so instances work in
    sets even when two clients happen to announce the same role.
    """

    conn: ClientConnection
    role: ClientRole = ClientRole.UNKNOWN


@dataclass
class HubState:
    """Mutable session state owned by a single :class:`Hub` instance."""

    score: Score | None = None
    validator: Validator | None = None
    clients: set[Client] = field(default_factory=set)
    playing: bool = False
    paused: bool = False
    # Kept on the hub rather than per-validator so a user-chosen
    # tolerance survives score reloads (the plugin can push a new
    # timeline at any time; the slider should not reset).
    tolerance_ms: float = DEFAULT_TOLERANCE_MS
    # Replay-speed multiplier. Authoritative on the server so every
    # connected UI sees the same factor echoed via status frames.
    playback_speed: float = DEFAULT_PLAYBACK_SPEED
