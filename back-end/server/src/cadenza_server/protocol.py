"""JSON message helpers shared between the server, plugin, and frontend."""

from __future__ import annotations

import json
from typing import Any


# Message types flowing *into* the server.
MSG_HELLO = "hello"                     # plugin/frontend handshake
MSG_SCORE = "score"                     # plugin: full score payload
MSG_LIST_MIDI = "list_midi"             # frontend: request device list
MSG_SELECT_MIDI = "select_midi"         # frontend: choose device
MSG_START = "start"                     # frontend: reset t=0 and start playback
MSG_PAUSE = "pause"                     # frontend: freeze the clock in place
MSG_RESUME = "resume"                   # frontend: continue playback from the paused position
MSG_STOP = "stop"                       # frontend: stop session
MSG_SET_TOLERANCE = "set_tolerance"     # frontend: adjust hit-timing tolerance (ms)

# Message types flowing *out* from the server.
MSG_STATUS = "status"
MSG_MIDI_PORTS = "midi_ports"
MSG_SCORE_TIMELINE = "score_timeline"
MSG_NOTE_TRIGGER = "note_trigger"
MSG_NOTE_PLAYED = "note_played"
MSG_ERROR = "error"


def encode(message: dict[str, Any]) -> str:
    return json.dumps(message, separators=(",", ":"))


def decode(raw: str | bytes) -> dict[str, Any]:
    if isinstance(raw, (bytes, bytearray)):
        raw = raw.decode("utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError("Expected a JSON object at the top level")
    return data
