"""JSON message helpers shared between the server, plugin, and frontend.

The message type catalogue is modelled as a :class:`StrEnum` so it can be
compared against plain strings arriving from the wire *and* enumerated
for exhaustive dispatch. The previous flat ``MSG_*`` constants are kept
as module-level attributes for backward compatibility with any consumer
that imported them by name.
"""

from __future__ import annotations

import json
from enum import StrEnum
from typing import Any


class MessageType(StrEnum):
    """Enumeration of every JSON ``type`` travelling over the hub.

    Members are grouped by direction (into the server vs. out from the
    server) but the enum itself doesn't encode direction — downstream
    dispatch code is simpler when it can match on a single enum.
    """

    # Inbound (plugin / frontend -> server).
    HELLO = "hello"
    SCORE = "score"
    LIST_MIDI = "list_midi"
    SELECT_MIDI = "select_midi"
    START = "start"
    PAUSE = "pause"
    RESUME = "resume"
    STOP = "stop"
    SET_TOLERANCE = "set_tolerance"
    SET_PLAYBACK_SPEED = "set_playback_speed"

    # Outbound (server -> plugin / frontend).
    STATUS = "status"
    MIDI_PORTS = "midi_ports"
    SCORE_TIMELINE = "score_timeline"
    NOTE_TRIGGER = "note_trigger"
    NOTE_PLAYED = "note_played"
    ERROR = "error"


# Legacy module-level aliases (pre-0.2 consumers).
MSG_HELLO = MessageType.HELLO
MSG_SCORE = MessageType.SCORE
MSG_LIST_MIDI = MessageType.LIST_MIDI
MSG_SELECT_MIDI = MessageType.SELECT_MIDI
MSG_START = MessageType.START
MSG_PAUSE = MessageType.PAUSE
MSG_RESUME = MessageType.RESUME
MSG_STOP = MessageType.STOP
MSG_SET_TOLERANCE = MessageType.SET_TOLERANCE
MSG_SET_PLAYBACK_SPEED = MessageType.SET_PLAYBACK_SPEED
MSG_STATUS = MessageType.STATUS
MSG_MIDI_PORTS = MessageType.MIDI_PORTS
MSG_SCORE_TIMELINE = MessageType.SCORE_TIMELINE
MSG_NOTE_TRIGGER = MessageType.NOTE_TRIGGER
MSG_NOTE_PLAYED = MessageType.NOTE_PLAYED
MSG_ERROR = MessageType.ERROR


def encode(message: dict[str, Any]) -> str:
    """Serialize ``message`` to a compact UTF-8 JSON string."""
    return json.dumps(message, separators=(",", ":"))


def decode(raw: str | bytes | bytearray) -> dict[str, Any]:
    """Parse an incoming frame into a dict, rejecting non-object payloads."""
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object at the top level")
    return data
