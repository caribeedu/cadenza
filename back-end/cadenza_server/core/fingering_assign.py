"""Assign finger numbers (1-5) per hand using editorial data or Performer DP."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from typing import Any, Callable

from cadenza_server.core.score import ScoreNote

FingeringProgressFn = Callable[[dict[str, Any]], None]
from cadenza_server.core.vendor.performer_fingering import compute_fingering

# Milliseconds — notes closer than this share one rhythmic "layer" for fingering.
_ONSET_EPS_MS = 1.0

# Vendored cost tables only cover grand-staff MIDI range.
_MIDI_ALG_LO = 21
_MIDI_ALG_HI = 108


def _hand_for_staff(staff: int) -> str:
    """Grand staff: staff 1 is bass (left); everything else uses right-hand tables."""
    return "left" if staff == 1 else "right"


def _build_layer_input(group: list[ScoreNote]) -> dict[str, Any] | list[Any]:
    ordered = sorted(group, key=lambda n: n.pitch)
    pitches = [n.pitch for n in ordered]
    fingers = [n.finger for n in ordered]
    if all(f is not None for f in fingers):
        return {"notes": pitches, "fingers": fingers}
    return pitches


def _collect_staff_job(
    notes: list[ScoreNote],
    staff: int,
    idxs: list[int],
) -> tuple[str, list[Any], list[list[tuple[int, ScoreNote]]]] | None:
    pairs = sorted([(i, notes[i]) for i in idxs], key=lambda x: (x[1].start_ms, x[1].pitch))
    if not pairs:
        return None

    groups: list[list[tuple[int, ScoreNote]]] = []
    cur = [pairs[0]]
    for p in pairs[1:]:
        if abs(p[1].start_ms - cur[0][1].start_ms) <= _ONSET_EPS_MS:
            cur.append(p)
        else:
            groups.append(cur)
            cur = [p]
    groups.append(cur)

    layer_inputs: list[Any] = []
    eligible_groups: list[list[tuple[int, ScoreNote]]] = []

    for gr in groups:
        needs = any(notes[i].finger is None for i, _ in gr)
        if not needs:
            continue
        pitches = [notes[i].pitch for i, _ in gr]
        if not all(_MIDI_ALG_LO <= p <= _MIDI_ALG_HI for p in pitches):
            continue
        layer_inputs.append(_build_layer_input([sn for _, sn in gr]))
        eligible_groups.append(gr)

    if not layer_inputs:
        return None
    hand = _hand_for_staff(staff)
    return hand, layer_inputs, eligible_groups


def _apply_computed_fingerings(
    notes: list[ScoreNote],
    *,
    progress: FingeringProgressFn | None = None,
) -> list[ScoreNote]:
    by_staff: dict[int, list[int]] = defaultdict(list)
    for i, n in enumerate(notes):
        by_staff[n.staff].append(i)

    jobs: list[tuple[int, str, list[Any], list[list[tuple[int, ScoreNote]]]]] = []
    for staff in sorted(by_staff.keys()):
        idxs = by_staff[staff]
        planned = _collect_staff_job(notes, staff, idxs)
        if planned is None:
            continue
        hand, layer_inputs, eligible_groups = planned
        jobs.append((staff, hand, layer_inputs, eligible_groups))

    out = list(notes)
    total_jobs = len(jobs)

    for job_index, (_staff, hand, layer_inputs, eligible_groups) in enumerate(jobs):
        if progress is not None and total_jobs:
            progress(
                {
                    "done": job_index,
                    "hand": hand,
                    "total": total_jobs,
                }
            )

        computed = compute_fingering(layer_inputs, hand)
        if len(computed) != len(eligible_groups):
            continue

        for gr, layer in zip(eligible_groups, computed, strict=True):
            gr_sorted = sorted(gr, key=lambda x: x[1].pitch)
            lp = layer["notes"]
            lf = layer["fingers"]
            if len(gr_sorted) != len(lp) or len(lp) != len(lf):
                continue
            if any(sn.pitch != p for (_, sn), p in zip(gr_sorted, lp, strict=True)):
                continue
            for (gi, _sn), f in zip(gr_sorted, lf, strict=True):
                if notes[gi].finger is None:
                    out[gi] = replace(notes[gi], finger=int(f))

    if progress is not None and total_jobs:
        last_hand = jobs[-1][1]
        progress({"done": total_jobs, "hand": last_hand, "total": total_jobs})

    return out


def assign_fingerings_if_needed(
    notes: list[ScoreNote],
    *,
    progress: FingeringProgressFn | None = None,
) -> list[ScoreNote]:
    """Fill missing ``finger`` values using the vendored Performer algorithm per staff."""
    if not notes:
        return notes
    if not any(n.finger is None for n in notes):
        return notes
    return _apply_computed_fingerings(notes, progress=progress)
