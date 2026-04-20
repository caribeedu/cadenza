"""Unit tests for :func:`cadenza_server.core.validator.unvalidated_reason`.

The helper captures the three-way branch inside the hub's MIDI-event
handler that decides whether an event should be validated or forwarded
as a raw neutral "note_played" with a reason code.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from cadenza_server.core.validator import unvalidated_reason


@pytest.fixture
def fake_validator() -> MagicMock:
    return MagicMock(name="Validator")


def test_no_score_returns_no_score() -> None:
    assert unvalidated_reason(None, playing=False, paused=False) == "no_score"
    # Even when playing/paused flags are nominally "on", lack of a score
    # wins — you can't validate against nothing.
    assert unvalidated_reason(None, playing=True, paused=False) == "no_score"
    assert unvalidated_reason(None, playing=True, paused=True) == "no_score"


def test_paused_beats_not_started(fake_validator: MagicMock) -> None:
    assert (
        unvalidated_reason(fake_validator, playing=False, paused=True) == "paused"
    )


def test_not_started_when_score_loaded_but_not_playing(
    fake_validator: MagicMock,
) -> None:
    assert (
        unvalidated_reason(fake_validator, playing=False, paused=False)
        == "not_started"
    )


def test_none_when_ready_to_validate(fake_validator: MagicMock) -> None:
    assert unvalidated_reason(fake_validator, playing=True, paused=False) is None


def test_playing_and_paused_together_still_blocks(
    fake_validator: MagicMock,
) -> None:
    assert (
        unvalidated_reason(fake_validator, playing=True, paused=True) == "paused"
    )
