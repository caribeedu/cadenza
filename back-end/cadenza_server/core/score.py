"""Score model and timeline builder.

The plugin emits notes whose offsets and durations are expressed in
quarter-note units (``quarterLength``) together with a tempo (BPM). We use
``music21`` to build a canonical stream so that offsets are resolved relative
to the start of the score, then convert each entry to absolute milliseconds.

All computation is done in-memory. Nothing is persisted to disk.
"""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass, field
from typing import Any, Callable

from music21 import note as m21_note, stream as m21_stream, tempo as m21_tempo

DEFAULT_BPM = 120.0


@dataclass(frozen=True)
class ScoreNote:
    """A single note with absolute timing in milliseconds.

    The ``id`` field is a stable monotonically increasing integer assigned
    at payload-ingest time. It exists so downstream consumers (notably the
    frontend mesh map) can address a specific scored note without having
    to compose a composite key from ``(pitch, start_ms)``, which would
    collide for e.g. a grace note followed by the same pitch within
    rounding distance. Value ``-1`` is reserved for the "legacy /
    unassigned" case and must never land on the wire in normal operation.
    """

    pitch: int
    start_ms: float
    duration_ms: float
    track: int = 0
    id: int = -1
    #: Staff index within the part (0 = top / treble on piano). Used for hand split.
    staff: int = 0
    #: 1-5 when known (editorial or computed). ``None`` if unavailable.
    finger: int | None = None

    @property
    def end_ms(self) -> float:
        return self.start_ms + self.duration_ms

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "id": self.id,
            "pitch": self.pitch,
            "start_ms": self.start_ms,
            "duration_ms": self.duration_ms,
            "track": self.track,
            "staff": self.staff,
        }
        if self.finger is not None:
            d["finger"] = self.finger
        return d


@dataclass
class Score:
    """Immutable-ish score timeline, sorted by ``start_ms``.

    ``title`` is optional metadata (typically the MuseScore filename or
    the composer's movement title). It travels over ``score_timeline``
    so the frontend can surface the current piece in the status bar.
    """

    bpm: float
    notes: list[ScoreNote] = field(default_factory=list)
    title: str | None = None

    def __post_init__(self) -> None:
        self.notes.sort(key=lambda n: (n.start_ms, n.pitch))

    @property
    def duration_ms(self) -> float:
        return max((n.end_ms for n in self.notes), default=0.0)

    def to_dict(self) -> dict[str, Any]:
        return {
            "bpm": self.bpm,
            "title": self.title,
            "duration_ms": self.duration_ms,
            "notes": [n.to_dict() for n in self.notes],
        }

    def notes_in_window(self, start_ms: float, end_ms: float) -> list[ScoreNote]:
        """Return notes whose start falls inside ``[start_ms, end_ms]``."""
        return [n for n in self.notes if start_ms <= n.start_ms <= end_ms]


def _normalise_tempo_map(raw_tempo_map: Any) -> list[tuple[float, float]]:
    """Coerce a plugin-provided tempo map to ``[(offset_ql, bpm), ...]``.

    Rules:
      * Entries with non-numeric / non-positive ``bpm`` or negative
        ``offset_ql`` are silently dropped (consistent with how
        individual malformed notes are handled).
      * Duplicates at the same offset: last-wins (matches
        ``Cadenza.qml``'s own dedup behaviour).
      * Sorted by ``offset_ql`` so the caller can insert MetronomeMarks
        in score order without re-sorting.
      * An absent / empty / non-list value yields an empty list — the
        caller then falls back to inserting a single MetronomeMark at
        offset 0 with ``default_bpm``.
    """
    if not isinstance(raw_tempo_map, list):
        return []

    at_offset: dict[float, float] = {}
    for raw in raw_tempo_map:
        if not isinstance(raw, dict):
            continue
        try:
            offset_ql = float(raw["offset_ql"])
            bpm = float(raw["bpm"])
        except (KeyError, TypeError, ValueError):
            continue
        if bpm <= 0 or offset_ql < 0:
            continue
        at_offset[offset_ql] = bpm
    return sorted(at_offset.items())


def _parse_staff(raw: dict[str, Any]) -> int:
    s = raw.get("staff")
    if s is None:
        return 0
    try:
        v = int(s)
    except (TypeError, ValueError):
        return 0
    return max(0, v)


def _parse_finger(raw: dict[str, Any]) -> int | None:
    f = raw.get("finger")
    if f is None:
        return None
    try:
        v = int(f)
    except (TypeError, ValueError):
        return None
    if 1 <= v <= 5:
        return v
    return None


def build_score_from_payload(
    payload: dict[str, Any],
    fingering_progress: Callable[[dict[str, Any]], None] | None = None,
) -> Score:
    """Build a :class:`Score` from a plugin payload.

    Expected JSON shape (fields marked optional have defaults)::

        {
            "type": "score",
            "bpm": 120,                      # optional, default 120
            "tempo_map": [                   # optional (TD-03)
                {"offset_ql": 0.0, "bpm": 120},
                {"offset_ql": 16.0, "bpm": 90},
                ...
            ],
            "notes": [
                {
                    "pitch": 60,
                    "offset_ql": 0.0,    # in quarter lengths
                    "duration_ql": 1.0,
                    "track": 0           # optional
                },
                ...
            ]
        }

    Any unknown keys are ignored. Notes and tempo-map entries missing or
    with invalid required fields are silently dropped.
    """
    raw_bpm = payload.get("bpm")
    bpm = float(raw_bpm) if raw_bpm is not None else DEFAULT_BPM
    if bpm <= 0:
        raise ValueError("bpm must be positive")

    raw_notes: Iterable[dict[str, Any]] = payload.get("notes") or []
    tempo_map = _normalise_tempo_map(payload.get("tempo_map"))
    title = _extract_title(payload.get("meta"))

    stream: m21_stream.Stream = m21_stream.Stream()
    if tempo_map:
        # Ensure a tempo is in effect from offset 0: if the map doesn't
        # start at 0 we prepend ``bpm`` there, otherwise the first note
        # before the first mark would have no MetronomeMark covering it
        # and music21 would silently fall back to its own default.
        if tempo_map[0][0] > 0:
            stream.insert(0, m21_tempo.MetronomeMark(number=bpm))
        for offset_ql, entry_bpm in tempo_map:
            stream.insert(offset_ql, m21_tempo.MetronomeMark(number=entry_bpm))
    else:
        stream.insert(0, m21_tempo.MetronomeMark(number=bpm))

    tracked: list[tuple[m21_note.Note, int, int, int, int | None]] = []
    for raw in raw_notes:
        try:
            pitch = int(raw["pitch"])
            offset_ql = float(raw["offset_ql"])
            duration_ql = float(raw.get("duration_ql", 0.0))
        except (KeyError, TypeError, ValueError):
            continue
        if pitch < 0 or pitch > 127 or duration_ql < 0 or offset_ql < 0:
            continue

        n = m21_note.Note()
        n.pitch.midi = pitch
        n.quarterLength = max(duration_ql, 1e-6)
        stream.insert(offset_ql, n)
        tracked.append(
            (
                n,
                pitch,
                int(raw.get("track", 0)),
                _parse_staff(raw if isinstance(raw, dict) else {}),
                _parse_finger(raw if isinstance(raw, dict) else {}),
            )
        )

    # music21 ``secondsMap`` resolves absolute timing taking tempo (and in
    # principle tempo changes) into account. Keying by the music21 element's
    # ``id()`` preserves the pitch/track metadata we captured at insertion
    # time regardless of how ``flatten()`` sorts elements.
    seconds_by_id: dict[int, dict[str, Any]] = {}
    for entry in stream.secondsMap:
        element = entry.get("element")
        if element is not None:
            seconds_by_id[id(element)] = entry

    resolved: list[ScoreNote] = []
    # Assign stable sequential ids in ingest order. This matches what the
    # plugin emitted (top-to-bottom walk of the score) and gives the
    # frontend a composite-key-free way to address each bar even if two
    # notes collapse under millisecond rounding.
    next_id = 0
    for m_note, pitch, track, staff, finger in tracked:
        entry = seconds_by_id.get(id(m_note))
        if entry is None:
            continue
        resolved.append(
            ScoreNote(
                id=next_id,
                pitch=pitch,
                start_ms=float(entry["offsetSeconds"]) * 1000.0,
                duration_ms=float(entry["durationSeconds"]) * 1000.0,
                track=track,
                staff=staff,
                finger=finger,
            )
        )
        next_id += 1

    from cadenza_server.core.fingering_assign import assign_fingerings_if_needed

    resolved = assign_fingerings_if_needed(resolved, progress=fingering_progress)

    return Score(bpm=bpm, notes=resolved, title=title)


def _extract_title(raw_meta: Any) -> str | None:
    """Pull ``meta.title`` out of a plugin payload, defensively.

    Returns ``None`` when missing, empty, whitespace-only, or not a
    string. We deliberately *don't* fall back to e.g. ``meta.composer``
    — an empty title is a better signal to the UI than a wrong one.
    """
    if not isinstance(raw_meta, dict):
        return None
    raw_title = raw_meta.get("title")
    if not isinstance(raw_title, str):
        return None
    cleaned = raw_title.strip()
    return cleaned or None
