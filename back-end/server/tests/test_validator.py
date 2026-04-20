"""Unit tests for the validation logic."""

from __future__ import annotations

import pytest

from cadenza_server.score import Score, ScoreNote
from cadenza_server.validator import DEFAULT_TOLERANCE_MS, Validator


def _score() -> Score:
    return Score(
        bpm=120.0,
        notes=[
            ScoreNote(id=0, pitch=60, start_ms=0.0, duration_ms=500.0),
            ScoreNote(id=1, pitch=62, start_ms=500.0, duration_ms=500.0),
            ScoreNote(id=2, pitch=60, start_ms=1000.0, duration_ms=500.0),
        ],
    )


class TestValidator:
    def test_correct_note_within_tolerance(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        result = v.validate(pitch=60, played_time_ms=40.0)
        assert result.correct is True
        assert result.expected is not None
        assert result.expected.start_ms == 0.0
        assert result.delta_ms == -40.0

    def test_wrong_pitch_near_target_reports_that_target(self) -> None:
        # New Phase-3 semantic: a wrong press inside the tolerance
        # window around an unconsumed scored note surfaces that note as
        # the intended target so the frontend can paint its bar red
        # ("this is the note you were aiming at").
        v = Validator(_score(), tolerance_ms=100.0)
        result = v.validate(pitch=61, played_time_ms=0.0)
        assert result.correct is False
        assert result.expected is not None
        assert result.expected.pitch == 60
        assert result.expected.start_ms == 0.0
        assert result.delta_ms == pytest.approx(0.0)

    def test_miss_far_from_any_note_reports_no_target(self) -> None:
        # Played at t=250 ms with tolerance=100 — the nearest scored
        # notes (60@0 and 62@500) are both 250 ms away, well outside
        # tolerance. There's no bar to colour, so expected is None and
        # the frontend falls back to a hit-line flash.
        v = Validator(_score(), tolerance_ms=100.0)
        result = v.validate(pitch=60, played_time_ms=250.0)
        assert result.correct is False
        assert result.expected is None
        assert result.delta_ms is None

    def test_each_note_is_only_matched_once(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        first = v.validate(pitch=60, played_time_ms=0.0)
        second = v.validate(pitch=60, played_time_ms=50.0)
        assert first.correct is True
        # Second hit at t~0 should not steal the already-consumed note; the
        # next unused C sits at 1000 ms which is outside tolerance.
        assert second.correct is False

    def test_reset_releases_consumed_notes(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)
        v.reset()
        again = v.validate(pitch=60, played_time_ms=0.0)
        assert again.correct is True

    def test_picks_closest_candidate(self) -> None:
        score = Score(
            bpm=120.0,
            notes=[
                ScoreNote(id=0, pitch=60, start_ms=0.0, duration_ms=500.0),
                ScoreNote(id=1, pitch=60, start_ms=80.0, duration_ms=500.0),
            ],
        )
        v = Validator(score, tolerance_ms=100.0)
        result = v.validate(pitch=60, played_time_ms=70.0)
        assert result.correct is True
        assert result.expected is not None
        assert result.expected.start_ms == 80.0

    def test_to_dict_surfaces_expected_id_for_all_outcomes(self) -> None:
        """TD-04: the frontend keys its mesh map by ``expected_id``; it
        must appear in the wire payload for every outcome where an
        expected note exists, and be ``None`` otherwise."""
        v = Validator(_score(), tolerance_ms=100.0)

        hit = v.validate(pitch=60, played_time_ms=0.0).to_dict()
        assert hit["correct"] is True
        assert hit["expected_id"] == 0

        near_miss = v.validate(pitch=63, played_time_ms=500.0).to_dict()
        assert near_miss["correct"] is False
        assert near_miss["expected_id"] == 1, (
            "Phase-3 near-miss must identify the target bar by id."
        )

        v.reset()
        v.validate(pitch=60, played_time_ms=0.0)
        penalty = v.validate(pitch=60, played_time_ms=100.0).to_dict()
        assert penalty["correct"] is False
        assert penalty["expected_id"] == 0, (
            "Phase-2 penalty must point back at the same id the user "
            "was supposed to hold — otherwise the bar flip to red would "
            "land on the wrong mesh under TD-04's collision case."
        )

        v.reset()
        random_miss = v.validate(pitch=60, played_time_ms=9999.0).to_dict()
        assert random_miss["correct"] is False
        assert random_miss["expected_id"] is None

    def test_negative_tolerance_is_rejected(self) -> None:
        with pytest.raises(ValueError):
            Validator(_score(), tolerance_ms=-1.0)


class TestValidatorToleranceSetter:
    """Regression suite for the live-tunable tolerance exposed to the UI.

    The tolerance slider updates the validator mid-session; we must
    preserve already-consumed bookkeeping (so the user doesn't get to
    re-hit the same note) and the new tolerance must take effect on the
    very next ``validate`` call."""

    def test_tightening_tolerance_turns_marginal_hit_into_miss(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        # 80 ms early: hit at tolerance=100, miss at tolerance=50.
        v.tolerance_ms = 50.0
        result = v.validate(pitch=60, played_time_ms=-80.0)
        assert result.correct is False
        # 80 ms is now outside the 50 ms tolerance in every phase —
        # there is no bar within reach, so the result carries no target.
        assert result.expected is None
        assert result.delta_ms is None

    def test_loosening_tolerance_turns_marginal_miss_into_hit(self) -> None:
        v = Validator(_score(), tolerance_ms=50.0)
        v.tolerance_ms = 150.0
        result = v.validate(pitch=60, played_time_ms=120.0)
        assert result.correct is True
        assert result.delta_ms == pytest.approx(-120.0)

    def test_setter_preserves_consumed_state(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        first = v.validate(pitch=60, played_time_ms=0.0)
        assert first.correct is True

        # Retuning mid-session must NOT release previously-consumed
        # notes; otherwise a user pressing the same note twice in a row
        # would get credited twice after any slider wiggle.
        v.tolerance_ms = 200.0
        second = v.validate(pitch=60, played_time_ms=20.0)
        assert second.correct is False

    def test_setter_rejects_negative(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        with pytest.raises(ValueError):
            v.tolerance_ms = -0.01
        # Sentinel: previous value must still be in effect.
        assert v.tolerance_ms == 100.0

    def test_setter_accepts_zero(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.tolerance_ms = 0.0
        assert v.tolerance_ms == 0.0
        result = v.validate(pitch=60, played_time_ms=0.0)
        # Exact-on-beat must still hit with zero tolerance.
        assert result.correct is True

    def test_default_tolerance_constant_is_exposed(self) -> None:
        # The frontend slider's default must match what the server uses
        # when no one has moved the slider yet — otherwise a fresh
        # session would silently disagree with the UI.
        assert DEFAULT_TOLERANCE_MS == 100.0


class TestValidatorActiveHitPenalty:
    """Regression suite for the 'hold the note' rule.

    After a correct hit, the scored note is tracked as "active" for its
    scored duration. Any additional MIDI note_on arriving before the
    note's end — whether a repeat of the same key or a different key —
    must be reported as ``correct=False`` with ``expected`` pointing at
    the active note, so the frontend flips its bar from green to red.
    """

    def test_repress_during_hold_window_penalises_the_active_note(self) -> None:
        # Score: 60@0 (500 ms), 62@500, 60@1000.
        v = Validator(_score(), tolerance_ms=100.0)

        first = v.validate(pitch=60, played_time_ms=0.0)
        assert first.correct is True
        assert first.expected is not None
        assert first.expected.start_ms == 0.0

        # Re-press of the same key 200 ms later, still inside 60@0's
        # hold window (0..500 ms).
        repress = v.validate(pitch=60, played_time_ms=200.0)
        assert repress.correct is False
        assert repress.expected is not None
        assert repress.expected.pitch == 60
        assert repress.expected.start_ms == 0.0, (
            "Re-pressing the correct key before the note ends must "
            "penalise the *same* note — its bar flips from green to red."
        )

    def test_wrong_key_during_hold_window_penalises_the_active_note(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)  # correct hit on 60@0

        # Wrong key (61 = C#, not in the score) 150 ms into 60@0's
        # 500 ms hold window. This is "playing over" the held note.
        spurious = v.validate(pitch=61, played_time_ms=150.0)
        assert spurious.correct is False
        assert spurious.expected is not None
        assert spurious.expected.pitch == 60
        assert spurious.expected.start_ms == 0.0

    def test_press_after_hold_window_does_not_penalise_stale_hit(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)

        # 60@0 ends at 500 ms; a spurious 61 at 700 ms is far from any
        # other scored note (62@500 is outside tolerance), so the
        # expected field falls through to Phase-4 None.
        late = v.validate(pitch=61, played_time_ms=700.0)
        assert late.correct is False
        assert late.expected is None, (
            "Once the hold window has closed, an unrelated press must "
            "not retro-penalise the previously-hit note."
        )

    def test_legitimate_next_note_during_hold_window_is_not_a_penalty(
        self,
    ) -> None:
        # Set up a score where two notes deliberately overlap: 60@0
        # for 800 ms and 62@500 for 500 ms. Hitting 62 at 500 ms is a
        # real new hit even though 60's hold window (0..800) is still
        # open — chord / legato playing must stay legal.
        score = Score(
            bpm=120.0,
            notes=[
                ScoreNote(pitch=60, start_ms=0.0, duration_ms=800.0),
                ScoreNote(pitch=62, start_ms=500.0, duration_ms=500.0),
            ],
        )
        v = Validator(score, tolerance_ms=100.0)

        v.validate(pitch=60, played_time_ms=0.0)
        chord_note = v.validate(pitch=62, played_time_ms=500.0)

        assert chord_note.correct is True, (
            "A legitimate Phase-1 match must win over the Phase-2 "
            "penalty path, otherwise any two overlapping scored notes "
            "would self-sabotage."
        )
        assert chord_note.expected is not None
        assert chord_note.expected.start_ms == 500.0

    def test_reset_clears_active_hits(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)
        v.reset()

        # After reset, 60@0 is fresh (consumed cleared) AND no longer
        # treated as active, so an early re-hit is just a normal hit.
        again = v.validate(pitch=60, played_time_ms=0.0)
        assert again.correct is True
