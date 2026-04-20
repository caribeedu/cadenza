"""Title metadata survives ingest and lands on ``Score.to_dict()``.

The plugin sends ``meta.title`` but the pre-feature builder dropped
every ``meta.*`` field. Without this contract the frontend's new
"currently playing" UI would silently stay empty.
"""

from __future__ import annotations

from cadenza_server.core.score import Score, build_score_from_payload


class TestTitleIngestion:
    def test_title_extracted_from_meta(self) -> None:
        score = build_score_from_payload(
            {
                "type": "score",
                "bpm": 120,
                "notes": [],
                "meta": {"title": "Fur Elise"},
            }
        )
        assert score.title == "Fur Elise"
        assert score.to_dict()["title"] == "Fur Elise"

    def test_missing_meta_yields_none_title(self) -> None:
        score = build_score_from_payload({"type": "score", "bpm": 120, "notes": []})
        assert score.title is None
        assert score.to_dict()["title"] is None

    def test_whitespace_only_title_is_normalised_to_none(self) -> None:
        score = build_score_from_payload(
            {
                "type": "score",
                "bpm": 120,
                "notes": [],
                "meta": {"title": "   "},
            }
        )
        assert score.title is None

    def test_non_string_title_ignored(self) -> None:
        score = build_score_from_payload(
            {
                "type": "score",
                "bpm": 120,
                "notes": [],
                "meta": {"title": 42},
            }
        )
        assert score.title is None

    def test_title_persists_through_dataclass_default(self) -> None:
        # Constructing a Score without a title should not crash and
        # should serialise the default ``None`` — guards the migration
        # for any test/fixture that still builds Score directly.
        score = Score(bpm=90)
        assert score.to_dict()["title"] is None
