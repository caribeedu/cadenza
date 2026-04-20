"""Unit tests for :func:`server.unvalidated_reason`.

The helper captures the three-way branch inside ``_handle_midi_event`` that
decides whether a MIDI event should be validated or forwarded as a raw
neutral "note_played" with a reason code. A previous bug was that the
frontend received ``correct: null`` but no reason, so users couldn't tell
whether they had forgotten to load a score, forgotten to press Start, or
were simply paused.
"""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from cadenza_server.server import unvalidated_reason


@pytest.fixture
def fake_validator() -> MagicMock:
    return MagicMock(name="Validator")


def test_no_score_returns_no_score(fake_validator) -> None:
    assert unvalidated_reason(None, playing=False, paused=False) == "no_score"
    # Even when playing/paused flags are nominally "on", lack of a score
    # wins — you can't validate against nothing.
    assert unvalidated_reason(None, playing=True, paused=False) == "no_score"
    assert unvalidated_reason(None, playing=True, paused=True) == "no_score"


def test_paused_beats_not_started(fake_validator) -> None:
    # If both flags indicate "not validating right now", ``paused`` is the
    # more specific signal and should take precedence so the UI hint
    # points at Resume rather than Start.
    assert (
        unvalidated_reason(fake_validator, playing=False, paused=True)
        == "paused"
    )


def test_not_started_when_score_loaded_but_not_playing(fake_validator) -> None:
    assert (
        unvalidated_reason(fake_validator, playing=False, paused=False)
        == "not_started"
    )


def test_none_when_ready_to_validate(fake_validator) -> None:
    # Score present, playing, not paused — the only configuration in
    # which the caller should proceed to ``validator.validate(...)``.
    assert unvalidated_reason(fake_validator, playing=True, paused=False) is None


def test_playing_and_paused_together_still_blocks(fake_validator) -> None:
    # Defensive: inconsistent state (both playing and paused) must not
    # accidentally fall through to validation.
    assert (
        unvalidated_reason(fake_validator, playing=True, paused=True)
        == "paused"
    )
