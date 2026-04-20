"""Unit tests for the JSON protocol helpers."""

from __future__ import annotations

import pytest

from cadenza_server import protocol


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
