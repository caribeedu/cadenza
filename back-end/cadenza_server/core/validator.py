"""Validation logic: compare an incoming MIDI hit against expected notes.

The validator is deterministic and side-effect free so it can be unit-tested
without a server loop. ``unvalidated_reason`` lives alongside it because it
is the pure decision function that tells the hub whether a MIDI event is
eligible for validation at all.

Four-phase decision tree, applied to every MIDI note_on:

    Phase 1 — exact match:
        The press lands within an asymmetric onset window (derived from
        the user-facing ``tolerance_ms``: tighter *before* the beat,
        wider *after*) around an unconsumed scored note at the same
        pitch. Mark the note consumed *and* "active" until its scored
        duration elapses, return ``correct=True``.

    Phase 2 — violated hold window:
        The press doesn't match anything new, but a previously-hit note
        is still in its hold window (``hit_time .. start + duration``).
        Return ``correct=False`` pointing at that note so the frontend
        flips its bar from green to red. Captures both "re-pressed the
        same key" and "played a wrong key while holding the right one".

    Phase 3 — near-target miss:
        The press is off-pitch but close in time to an unconsumed scored
        note (any pitch, within tolerance). Return ``correct=False``
        pointing at that note — it's the bar the user was aiming at.

    Phase 4 — random miss:
        The press isn't near any scored note. Return ``correct=False``
        with ``expected=None``; the frontend falls back to a hit-line
        flash because there's no bar to colour.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from cadenza_server.core.score import Score, ScoreNote

DEFAULT_TOLERANCE_MS = 130.0

# The UI exposes a single ``tolerance_ms`` slider; the engine maps it to an
# asymmetric onset window. Players tend to *lag* the visual beat more
# than they anticipate it, so we allow a wider window after the scored
# onset than before it — same nominal slider, friendlier hits without
# widening accidental early flams as much.
EARLY_TOLERANCE_FACTOR = 0.82
LATE_TOLERANCE_FACTOR = 1.38


@dataclass(frozen=True)
class ValidationResult:
    """Outcome of checking a played note against the score."""

    correct: bool
    played_pitch: int
    played_time_ms: float
    expected: ScoreNote | None
    delta_ms: float | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "correct": self.correct,
            "played_pitch": self.played_pitch,
            "played_time_ms": self.played_time_ms,
            # ``expected_id`` is the stable ScoreNote identifier assigned
            # at ingest time; the frontend prefers it to the composite
            # ``(pitch, start_ms)`` key to avoid TD-04's sub-millisecond
            # mesh-key collisions. Falls back to ``None`` when there is
            # no target to colour.
            "expected_id": self.expected.id if self.expected else None,
            "expected_pitch": self.expected.pitch if self.expected else None,
            "expected_time_ms": self.expected.start_ms if self.expected else None,
            "delta_ms": self.delta_ms,
        }


class Validator:
    """Matches played notes to scored notes within a time tolerance.

    A scored note can only be matched once. After a successful match the
    note is tracked as "active" for the duration of its hold window so
    that any *additional* presses arriving before the note ends — whether
    a repeat of the same key or a different key — are reported as a
    miss against the same note. This captures the user-facing rule "hold
    the note without re-pressing and without playing over it".
    """

    def __init__(self, score: Score, tolerance_ms: float = DEFAULT_TOLERANCE_MS) -> None:
        if tolerance_ms < 0:
            raise ValueError("tolerance_ms must be >= 0")
        self._score = score
        self._tolerance_ms = float(tolerance_ms)
        self._consumed: set[int] = set()
        # index → (hit_time_ms, note). Populated on every Phase-1 hit;
        # entries expire when ``played_time_ms > note.start_ms + duration``.
        self._active_hits: dict[int, tuple[float, ScoreNote]] = {}

    @property
    def score(self) -> Score:
        return self._score

    @property
    def tolerance_ms(self) -> float:
        return self._tolerance_ms

    @tolerance_ms.setter
    def tolerance_ms(self, value: float) -> None:
        """Retune tolerance without rebuilding the validator — crucial
        so a mid-session slider change applies to the next note without
        dropping ``_consumed`` / ``_active_hits`` bookkeeping."""
        if value < 0:
            raise ValueError("tolerance_ms must be >= 0")
        self._tolerance_ms = float(value)

    def reset(self) -> None:
        self._consumed.clear()
        self._active_hits.clear()

    def validate(self, pitch: int, played_time_ms: float) -> ValidationResult:
        """Return the result of matching ``pitch`` played at ``played_time_ms``."""
        self._purge_expired_active_hits(played_time_ms)

        match_idx = self._find_match(pitch, played_time_ms)
        if match_idx is not None:
            self._consumed.add(match_idx)
            note = self._score.notes[match_idx]
            self._active_hits[match_idx] = (played_time_ms, note)
            return ValidationResult(
                correct=True,
                played_pitch=pitch,
                played_time_ms=played_time_ms,
                expected=note,
                delta_ms=note.start_ms - played_time_ms,
            )

        violated = self._violated_active_hit(played_time_ms)
        if violated is not None:
            _hit_time, note = violated
            return ValidationResult(
                correct=False,
                played_pitch=pitch,
                played_time_ms=played_time_ms,
                expected=note,
                delta_ms=note.start_ms - played_time_ms,
            )

        closest = self._closest_unconsumed_within_tolerance(played_time_ms)
        if closest is not None:
            return ValidationResult(
                correct=False,
                played_pitch=pitch,
                played_time_ms=played_time_ms,
                expected=closest,
                delta_ms=closest.start_ms - played_time_ms,
            )

        return ValidationResult(
            correct=False,
            played_pitch=pitch,
            played_time_ms=played_time_ms,
            expected=None,
            delta_ms=None,
        )

    def _within_onset_window(self, played_time_ms: float, onset_ms: float) -> bool:
        """True if ``played_time_ms`` falls within the asymmetric window."""
        delta = played_time_ms - onset_ms  # negative → early, positive → late
        early = self._tolerance_ms * EARLY_TOLERANCE_FACTOR
        late = self._tolerance_ms * LATE_TOLERANCE_FACTOR
        return -early <= delta <= late

    def _find_match(self, pitch: int, played_time_ms: float) -> int | None:
        """Closest unconsumed scored note at ``pitch`` within tolerance."""
        best_idx: int | None = None
        best_abs_delta: float | None = None
        for idx, note in enumerate(self._score.notes):
            if idx in self._consumed:
                continue
            if note.pitch != pitch:
                continue
            if not self._within_onset_window(played_time_ms, note.start_ms):
                continue
            delta = abs(note.start_ms - played_time_ms)
            if best_abs_delta is None or delta < best_abs_delta:
                best_abs_delta = delta
                best_idx = idx
        return best_idx

    def _closest_unconsumed_within_tolerance(self, played_time_ms: float) -> ScoreNote | None:
        """Closest unconsumed scored note *of any pitch* within tolerance."""
        best_note: ScoreNote | None = None
        best_abs_delta: float | None = None
        for idx, note in enumerate(self._score.notes):
            if idx in self._consumed:
                continue
            if not self._within_onset_window(played_time_ms, note.start_ms):
                continue
            delta = abs(note.start_ms - played_time_ms)
            if best_abs_delta is None or delta < best_abs_delta:
                best_abs_delta = delta
                best_note = note
        return best_note

    def _purge_expired_active_hits(self, now_ms: float) -> None:
        # Half-open window ``[start, start + duration)``: the moment
        # ``now_ms`` reaches the note's scored end time, the hold is
        # over and the next press belongs to the next beat rather than
        # violating the previous hold. Using strict ``>`` here would
        # cause Phase 2 to steal ``t == start_ms + duration_ms`` from
        # Phase 3 (the near-target miss for the *next* note), which is
        # both musically wrong and what the regression suite asserts.
        expired = [
            idx
            for idx, (_hit, note) in self._active_hits.items()
            if now_ms >= note.start_ms + note.duration_ms
        ]
        for idx in expired:
            del self._active_hits[idx]

    def _violated_active_hit(self, played_time_ms: float) -> tuple[float, ScoreNote] | None:
        """Return ``(hit_time, note)`` for any active hit whose hold
        window covers ``played_time_ms``.

        Deterministic pick: if several active hits are simultaneously
        in their hold window (overlapping chord), prefer the one with
        the *latest* scored end time — that's the one that would still
        be "under" the hit-line right now. Sorted by index as a stable
        tie-breaker.
        """
        best: tuple[float, ScoreNote] | None = None
        best_end: float | None = None
        for idx in sorted(self._active_hits):
            hit_time, note = self._active_hits[idx]
            end = note.start_ms + note.duration_ms
            if hit_time <= played_time_ms <= end and (best_end is None or end > best_end):
                best_end = end
                best = (hit_time, note)
        return best


def unvalidated_reason(validator: Validator | None, *, playing: bool, paused: bool) -> str | None:
    """Why an incoming MIDI event is *not* being validated right now.

    Returns ``None`` when validation can proceed, otherwise one of:

    * ``"no_score"``    — no MuseScore timeline has been ingested yet.
    * ``"paused"``      — session was paused via ``MessageType.PAUSE``.
    * ``"not_started"`` — score loaded but playback hasn't been started.

    Pure function (no side effects) so it's directly unit-testable without
    spinning up the hub.
    """
    if validator is None:
        return "no_score"
    if paused:
        return "paused"
    if not playing:
        return "not_started"
    return None
