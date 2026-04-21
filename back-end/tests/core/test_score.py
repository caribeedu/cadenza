"""Unit tests for the score/timeline builder."""

from __future__ import annotations

import math

import pytest

from cadenza_server.core.score import (
    DEFAULT_BPM,
    Score,
    ScoreNote,
    build_score_from_payload,
)


def approx(value: float, expected: float, tol: float = 1e-3) -> bool:
    return math.isclose(value, expected, abs_tol=tol)


class TestBuildScoreFromPayload:
    def test_empty_payload_defaults_to_120_bpm(self) -> None:
        score = build_score_from_payload({})
        assert score.bpm == DEFAULT_BPM
        assert score.notes == []
        assert score.duration_ms == 0.0

    def test_offsets_converted_to_milliseconds_at_120_bpm(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": 62, "offset_ql": 1.0, "duration_ql": 0.5},
                {"pitch": 64, "offset_ql": 2.0, "duration_ql": 2.0},
            ],
        }
        score = build_score_from_payload(payload)

        assert [n.pitch for n in score.notes] == [60, 62, 64]
        assert approx(score.notes[0].start_ms, 0.0)
        assert approx(score.notes[1].start_ms, 500.0)
        assert approx(score.notes[2].start_ms, 1000.0)
        assert approx(score.notes[0].duration_ms, 500.0)
        assert approx(score.notes[1].duration_ms, 250.0)
        assert approx(score.notes[2].duration_ms, 1000.0)

    def test_scales_with_bpm(self) -> None:
        payload = {
            "bpm": 60,
            "notes": [{"pitch": 60, "offset_ql": 1.0, "duration_ql": 1.0}],
        }
        score = build_score_from_payload(payload)
        assert approx(score.notes[0].start_ms, 1000.0)
        assert approx(score.notes[0].duration_ms, 1000.0)

    def test_skips_malformed_notes(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": "oops", "offset_ql": 1.0, "duration_ql": 1.0},
                {"pitch": 200, "offset_ql": 2.0, "duration_ql": 1.0},
                {"offset_ql": 3.0, "duration_ql": 1.0},
                {"pitch": 62, "offset_ql": -1.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        assert [n.pitch for n in score.notes] == [60]

    def test_rejects_invalid_bpm(self) -> None:
        with pytest.raises(ValueError):
            build_score_from_payload({"bpm": 0, "notes": []})

    def test_notes_are_sorted_and_duration_is_max_end(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 64, "offset_ql": 2.0, "duration_ql": 1.0},
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        assert [n.pitch for n in score.notes] == [60, 64]
        assert approx(score.duration_ms, 1500.0)


class TestTempoMap:
    """Regression suite for TD-03 — the timeline must honour every entry
    of the plugin's ``tempo_map``, not just the first tempo."""

    def test_absent_tempo_map_behaves_like_single_tempo(self) -> None:
        payload = {
            "bpm": 60,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        assert approx(score.notes[0].start_ms, 0.0)
        assert approx(score.notes[1].start_ms, 1000.0)

    def test_tempo_change_mid_piece_shifts_subsequent_notes(self) -> None:
        payload = {
            "bpm": 120,
            "tempo_map": [
                {"offset_ql": 0.0, "bpm": 120},
                {"offset_ql": 2.0, "bpm": 60},
            ],
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": 60, "offset_ql": 1.0, "duration_ql": 1.0},
                {"pitch": 60, "offset_ql": 2.0, "duration_ql": 1.0},
                {"pitch": 60, "offset_ql": 3.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        starts = [n.start_ms for n in score.notes]
        assert approx(starts[0], 0.0)
        assert approx(starts[1], 500.0)
        assert approx(starts[2], 1000.0), (
            f"First note under the second tempo landed at {starts[2]} ms — "
            "the tempo change at offset_ql=2.0 was not honoured."
        )
        assert approx(starts[3], 2000.0)

    def test_initial_bpm_covers_notes_before_first_map_entry(self) -> None:
        payload = {
            "bpm": 120,
            "tempo_map": [{"offset_ql": 2.0, "bpm": 60}],
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": 60, "offset_ql": 1.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        assert approx(score.notes[0].start_ms, 0.0)
        assert approx(score.notes[1].start_ms, 500.0)

    def test_malformed_tempo_entries_are_silently_dropped(self) -> None:
        payload = {
            "bpm": 120,
            "tempo_map": [
                {"offset_ql": 0.0, "bpm": 120},
                {"offset_ql": -1.0, "bpm": 90},
                {"offset_ql": 1.0, "bpm": 0},
                {"offset_ql": 1.0},
                "not a dict",
                {"offset_ql": 2.0, "bpm": 60},
            ],
            "notes": [{"pitch": 60, "offset_ql": 3.0, "duration_ql": 1.0}],
        }
        score = build_score_from_payload(payload)
        assert approx(score.notes[0].start_ms, 2000.0)

    def test_duplicate_offsets_use_last_seen_tempo(self) -> None:
        payload = {
            "bpm": 120,
            "tempo_map": [
                {"offset_ql": 0.0, "bpm": 120},
                {"offset_ql": 0.0, "bpm": 60},
            ],
            "notes": [{"pitch": 60, "offset_ql": 1.0, "duration_ql": 1.0}],
        }
        score = build_score_from_payload(payload)
        assert approx(score.notes[0].start_ms, 1000.0)

    def test_unsorted_tempo_map_input_is_normalised(self) -> None:
        payload = {
            "bpm": 120,
            "tempo_map": [
                {"offset_ql": 2.0, "bpm": 60},
                {"offset_ql": 0.0, "bpm": 120},
            ],
            "notes": [{"pitch": 60, "offset_ql": 2.0, "duration_ql": 1.0}],
        }
        score = build_score_from_payload(payload)
        assert approx(score.notes[0].start_ms, 1000.0)


class TestScoreNoteIds:
    """Regression suite for TD-04 — every scored note must carry a
    unique, stable integer id so the frontend can key its mesh map by
    id rather than the collision-prone ``(pitch, start_ms)`` composite.
    """

    def test_ids_are_unique_and_contiguous(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0},
                {"pitch": 64, "offset_ql": 2.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        ids = [n.id for n in score.notes]
        assert ids == sorted(set(ids)), "ids must be unique"
        assert ids == list(range(len(ids)))

    def test_collapsed_timing_notes_keep_distinct_ids(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 0.1},
                {"pitch": 60, "offset_ql": 0.0006, "duration_ql": 0.1},
            ],
        }
        score = build_score_from_payload(payload)
        assert len(score.notes) == 2
        assert score.notes[0].id != score.notes[1].id
        assert round(score.notes[0].start_ms) == round(score.notes[1].start_ms)

    def test_to_dict_includes_id(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [{"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0}],
        }
        score = build_score_from_payload(payload)
        wire = score.to_dict()
        assert "notes" in wire and len(wire["notes"]) == 1
        assert wire["notes"][0]["id"] == 0
        assert wire["notes"][0]["staff"] == 0

    def test_malformed_notes_dont_consume_ids(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0},
                {"pitch": "oops", "offset_ql": 1.0, "duration_ql": 1.0},
                {"pitch": 62, "offset_ql": 2.0, "duration_ql": 1.0},
            ],
        }
        score = build_score_from_payload(payload)
        assert [n.id for n in score.notes] == [0, 1]


class TestFingering:
    """Editorial ``finger`` from the payload is kept; gaps use the vendored DP."""

    def test_editorial_finger_preserved_and_fallback_fills_rest(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0, "staff": 0, "finger": 2},
                {"pitch": 64, "offset_ql": 1.0, "duration_ql": 1.0, "staff": 0},
            ],
        }
        score = build_score_from_payload(payload)
        assert score.notes[0].finger == 2
        assert score.notes[1].finger is not None
        assert 1 <= score.notes[1].finger <= 5

    def test_invalid_finger_in_payload_is_ignored_then_computed(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0, "staff": 0, "finger": 9},
            ],
        }
        score = build_score_from_payload(payload)
        assert score.notes[0].finger is not None

    def test_left_hand_staff_gets_fingering(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 48, "offset_ql": 0.0, "duration_ql": 1.0, "staff": 1},
                {"pitch": 52, "offset_ql": 1.0, "duration_ql": 1.0, "staff": 1},
            ],
        }
        score = build_score_from_payload(payload)
        assert all(n.finger is not None for n in score.notes)

    def test_fingering_progress_callback_records_hands(self) -> None:
        payload = {
            "bpm": 120,
            "notes": [
                {"pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0, "staff": 0},
                {"pitch": 48, "offset_ql": 0.0, "duration_ql": 1.0, "staff": 1},
            ],
        }
        events: list[dict[str, int | str]] = []

        def progress(info: dict[str, int | str]) -> None:
            events.append(info)

        build_score_from_payload(payload, fingering_progress=progress)
        assert len(events) >= 2
        assert events[-1]["done"] == events[-1]["total"]
        hands = {str(e["hand"]) for e in events}
        assert "left" in hands
        assert "right" in hands


class TestScore:
    def test_notes_in_window(self) -> None:
        score = Score(
            bpm=120.0,
            notes=[
                ScoreNote(pitch=60, start_ms=0.0, duration_ms=500.0),
                ScoreNote(pitch=62, start_ms=500.0, duration_ms=500.0),
                ScoreNote(pitch=64, start_ms=1000.0, duration_ms=500.0),
            ],
        )
        assert [n.pitch for n in score.notes_in_window(400.0, 1100.0)] == [62, 64]
