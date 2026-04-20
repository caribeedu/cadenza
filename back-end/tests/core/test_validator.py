"""Unit tests for the validation logic."""

from __future__ import annotations

import pytest

from cadenza_server.core.score import Score, ScoreNote
from cadenza_server.core.validator import (
    DEFAULT_TOLERANCE_MS,
    EARLY_TOLERANCE_FACTOR,
    LATE_TOLERANCE_FACTOR,
    Validator,
)


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
        v = Validator(_score(), tolerance_ms=100.0)
        result = v.validate(pitch=61, played_time_ms=0.0)
        assert result.correct is False
        assert result.expected is not None
        assert result.expected.pitch == 60
        assert result.expected.start_ms == 0.0
        assert result.delta_ms == pytest.approx(0.0)

    def test_miss_far_from_any_note_reports_no_target(self) -> None:
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
        v = Validator(_score(), tolerance_ms=100.0)

        hit = v.validate(pitch=60, played_time_ms=0.0).to_dict()
        assert hit["correct"] is True
        assert hit["expected_id"] == 0

        near_miss = v.validate(pitch=63, played_time_ms=500.0).to_dict()
        assert near_miss["correct"] is False
        assert near_miss["expected_id"] == 1

        v.reset()
        v.validate(pitch=60, played_time_ms=0.0)
        penalty = v.validate(pitch=60, played_time_ms=100.0).to_dict()
        assert penalty["correct"] is False
        assert penalty["expected_id"] == 0

        v.reset()
        random_miss = v.validate(pitch=60, played_time_ms=9999.0).to_dict()
        assert random_miss["correct"] is False
        assert random_miss["expected_id"] is None

    def test_negative_tolerance_is_rejected(self) -> None:
        with pytest.raises(ValueError):
            Validator(_score(), tolerance_ms=-1.0)


class TestAsymmetricOnsetWindow:
    """The slider's ``tolerance_ms`` maps to a wider late than early window."""

    def test_late_press_beyond_symmetric_radius_can_still_hit(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        # Symmetric ±100 would miss at +130; late window is 100 * 1.38 = 138.
        result = v.validate(pitch=60, played_time_ms=130.0)
        assert result.correct is True

    def test_early_press_beyond_early_radius_misses(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        # Early window is 100 * 0.82 = 82 ms before onset.
        result = v.validate(pitch=60, played_time_ms=-90.0)
        assert result.correct is False
        assert result.expected is None

    def test_factors_are_documented(self) -> None:
        assert 0 < EARLY_TOLERANCE_FACTOR < LATE_TOLERANCE_FACTOR


class TestValidatorToleranceSetter:
    def test_tightening_tolerance_turns_marginal_hit_into_miss(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.tolerance_ms = 50.0
        result = v.validate(pitch=60, played_time_ms=-80.0)
        assert result.correct is False
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

        v.tolerance_ms = 200.0
        second = v.validate(pitch=60, played_time_ms=20.0)
        assert second.correct is False

    def test_setter_rejects_negative(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        with pytest.raises(ValueError):
            v.tolerance_ms = -0.01
        assert v.tolerance_ms == 100.0

    def test_setter_accepts_zero(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.tolerance_ms = 0.0
        assert v.tolerance_ms == 0.0
        result = v.validate(pitch=60, played_time_ms=0.0)
        assert result.correct is True

    def test_default_tolerance_constant_is_exposed(self) -> None:
        assert DEFAULT_TOLERANCE_MS == 130.0


class TestValidatorActiveHitPenalty:
    def test_repress_during_hold_window_penalises_the_active_note(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)

        first = v.validate(pitch=60, played_time_ms=0.0)
        assert first.correct is True

        repress = v.validate(pitch=60, played_time_ms=200.0)
        assert repress.correct is False
        assert repress.expected is not None
        assert repress.expected.pitch == 60
        assert repress.expected.start_ms == 0.0

    def test_wrong_key_during_hold_window_penalises_the_active_note(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)

        spurious = v.validate(pitch=61, played_time_ms=150.0)
        assert spurious.correct is False
        assert spurious.expected is not None
        assert spurious.expected.pitch == 60
        assert spurious.expected.start_ms == 0.0

    def test_press_after_hold_window_does_not_penalise_stale_hit(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)

        late = v.validate(pitch=61, played_time_ms=700.0)
        assert late.correct is False
        assert late.expected is None

    def test_legitimate_next_note_during_hold_window_is_not_a_penalty(self) -> None:
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

        assert chord_note.correct is True
        assert chord_note.expected is not None
        assert chord_note.expected.start_ms == 500.0

    def test_reset_clears_active_hits(self) -> None:
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)
        v.reset()

        again = v.validate(pitch=60, played_time_ms=0.0)
        assert again.correct is True

    def test_press_at_exact_end_of_hold_window_is_next_beat_not_penalty(
        self,
    ) -> None:
        """Boundary regression: ``played_time_ms == start_ms + duration_ms``.

        The hold window is half-open ``[start, start + duration)``; at
        the exact end the previous note is done and the press belongs
        to the next beat. Before the fix this pressed time landed in
        Phase 2 (violated hold) instead of Phase 3 (near-target miss
        for the next scored note), reporting ``expected_id`` of the
        *previous* note instead of the *next* one.
        """
        v = Validator(_score(), tolerance_ms=100.0)
        v.validate(pitch=60, played_time_ms=0.0)

        boundary = v.validate(pitch=63, played_time_ms=500.0)

        assert boundary.correct is False
        assert boundary.expected is not None
        assert boundary.expected.id == 1, (
            "Press at t == previous note's end must resolve against "
            "the next scored note, not violate the just-ended hold."
        )
        assert boundary.expected.start_ms == 500.0
