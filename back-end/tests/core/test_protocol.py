"""Unit tests for the JSON protocol helpers."""

from __future__ import annotations

import pytest

from cadenza_server.core import protocol
from cadenza_server.core.protocol import MessageType


class TestProtocol:
    def test_round_trip(self) -> None:
        msg = {"type": protocol.MSG_HELLO, "role": "plugin"}
        encoded = protocol.encode(msg)
        assert protocol.decode(encoded) == msg

    def test_decode_accepts_bytes(self) -> None:
        payload = b'{"type":"hello","role":"frontend"}'
        assert protocol.decode(payload)["role"] == "frontend"

    def test_decode_rejects_non_object(self) -> None:
        with pytest.raises(ValueError):
            protocol.decode("[]")

    def test_message_type_enum_values_are_stable(self) -> None:
        # Wire-level strings are part of the public contract with the
        # frontend and the plugin. Renaming the enum member is fine;
        # changing its string value is a breaking change. Pin them.
        assert MessageType.HELLO == "hello"
        assert MessageType.SCORE == "score"
        assert MessageType.STATUS == "status"
        assert MessageType.NOTE_PLAYED == "note_played"
        assert MessageType.NOTE_OFF == "note_off"

    def test_pause_and_resume_constants_exist(self) -> None:
        # Regression guard: the pause-in-place UX relies on MSG_PAUSE and
        # MSG_RESUME being part of the protocol surface the hub dispatches
        # against. If either disappears, the frontend silently no-ops and
        # the user sees Pause/Resume "do nothing".
        assert protocol.MSG_PAUSE == "pause"
        assert protocol.MSG_RESUME == "resume"
        assert protocol.MSG_PAUSE != protocol.MSG_STOP

    def test_set_tolerance_constant_exists(self) -> None:
        # The tolerance slider on the frontend sends MSG_SET_TOLERANCE;
        # if this string ever drifts from the Python side, the slider
        # silently stops doing anything and users would think the
        # setting was persistent when it wasn't.
        assert protocol.MSG_SET_TOLERANCE == "set_tolerance"
        assert protocol.MSG_SET_TOLERANCE != protocol.MSG_START

    def test_top_level_reexports_survive_restructure(self) -> None:
        # Backwards-compat regression: the 0.2 migration moved modules
        # into subpackages. ``from cadenza_server import X`` for the
        # stable names must keep working.
        from cadenza_server import (
            Score,
            ScoreNote,
            Validator,
            build_score_from_payload,
            decode,
            encode,
            unvalidated_reason,
        )

        assert callable(build_score_from_payload)
        assert callable(decode)
        assert callable(encode)
        assert callable(unvalidated_reason)
        assert Score is not None
        assert ScoreNote is not None
        assert Validator is not None
