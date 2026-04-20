# Automatic finger numbering · Feasibility and plan

## TL;DR

**Yes, automatic fingering is feasible** using a small, MIT-licensed
Python library (`pianoplayer`) already based on `music21`, which
matches our backend stack exactly. Integration is ~1 day of work with
one new dependency, one new field on `ScoreNote`, and a small frontend
tweak to draw the digit under each note.

The output is "adequate for practice" quality — good on classical and
pop repertoire in standard keys, noticeably worse on dense polyphony
or unusual hand positions. Not engraver-grade. That is the universal
bottleneck across every existing automatic fingering system, not a
library-specific limitation.

---

## Problem framing

For every note in the score, assign a finger number:

| Code | Finger                      |
| ---- | --------------------------- |
| 1    | Thumb                       |
| 2    | Index                       |
| 3    | Middle                      |
| 4    | Ring                        |
| 5    | Little                      |

We also need to know **which hand** owns the note. That's typically
read from the staff in a MusicXML score (staff 1 = right, staff 2 = left
in standard piano notation), not from pitch alone.

The problem is surprisingly hard because good fingering depends on:

- **Local geometry** — intervals between consecutive notes, black vs
  white key positions, hand span.
- **Look-ahead** — a good choice now may corner you three notes later
  (thumbs-under, crossings).
- **Articulation** — legato forces pairs of notes to share no finger;
  staccato relaxes this.
- **Stylistic conventions** — scales, arpeggios, Alberti bass, etc.
  have idiomatic fingerings humans expect.
- **Player-specific constraints** — small hand, long fingers, previous
  injury. We have no model of the user.

Every published algorithm treats it as graph shortest-path or
HMM/Viterbi over (note, finger) states with hand-biomechanics-derived
costs. The state of the art (Nakamura et al.) trains on a human-
annotated corpus (PIG dataset, ~150 pieces) and reaches ~70 % agreement
with a single human annotator. No system is engraver-quality.

---

## Options

### Option A · `pianoplayer` (recommended)

- GitHub: `marcomusy/pianoplayer`
- License: **MIT**
- Latest release: 3.0.1 (March 2026), actively maintained
- Built on `music21` (which we already depend on).
- Algorithm: graph search minimising a hand-biomechanics cost function
  (Hart-Bosch-Tromp 1997 derivative). Fast, deterministic.
- Inputs: `music21.stream.Score` with staves assigned to hands.
- Outputs: the same Stream with `music21.articulations.Fingering`
  objects attached to each Note.

Fit for our stack:

- Our backend already builds a `music21` Stream from the plugin payload
  (`score.py`). We can thread it directly into pianoplayer with minimal
  glue.
- Fingering is a **one-shot pre-computation** at score load time
  (O(milliseconds) for a standard piano piece). Doesn't affect the hot
  MIDI path.

Limitations:

- Needs a clean hand separation. Our current plugin emits a `track`
  number per note (`partIdx`). MuseScore typically lays piano on one
  `Part` with two staves, so `track` is **not** hand. We must read the
  staff index from MuseScore's cursor and forward it as `staff` (0 = RH,
  1 = LH) instead of (or in addition to) `track`.
- pianoplayer's quality degrades on:
  - Hand crossings not marked in the score.
  - Polyphony within a single staff (inner voice fingerings).
  - Very fast passages where the biomechanics cost gets brittle.

### Option B · roll our own heuristic

Write a small Python module with hard-coded rules:

- Scale detection → 1-2-3-1-2-3-4-5 pattern.
- Repeated notes → same finger or 1-2-1-2 alternation.
- Chord → map lowest/middle/top note to 1/3/5 (RH) or 5/3/1 (LH).

Pros: zero dependency, ~200 lines.
Cons: falls apart outside the detected patterns; worse than pianoplayer
everywhere else; will produce obviously wrong fingerings that users
will notice.

Not recommended. Ship pianoplayer first. Only revisit if its license,
maintenance, or performance becomes a problem (none currently are).

### Option C · neural / learned model

`Nakamura et al.` paper ships pretrained models. No PyPI package;
inference requires PyTorch or similar, and model weights are multi-MB.
Higher accuracy, much heavier dep footprint. Overkill for the MVP.

---

## Implementation plan (Option A)

### Dependency

Add to `back-end/pyproject.toml`:

```toml
dependencies = [
    # ... existing deps ...
    "pianoplayer>=3.0.1",
]
```

`uv sync` — no compilation, pure Python.

### Plugin side

`plugin/Cadenza.qml` — extend `collectNotes` to forward the
staff index. In MuseScore QML, a `Cursor` is iterated per `(part,
staff, voice)`; the loop already fixes voice/staff at
`cursor.track = partIdx * 4`. To walk both staves of a piano part, add
a second pass at `partIdx * 4 + 4` (next staff of same part). Cleaner
approach: iterate over every `staff` of every `part`:

```qml
for (var p = 0; p < score.parts.length; ++p) {
    var staves = score.parts[p].nstaves || 1;
    for (var s = 0; s < staves; ++s) {
        var cursor = score.newCursor();
        cursor.track = (p * staves + s) * 4; // first voice of staff s
        // ... existing walk ...
        notes.push({
            pitch: ...,
            offset_ql: ...,
            duration_ql: ...,
            track: p,
            staff: s,            // NEW: 0 = top staff (usually RH), 1 = bottom
        });
    }
}
```

> This also fixes a latent bug: the current plugin only reads staff 0 of
> each part, so the left hand of a two-staff piano score is silently
> dropped.

### Backend

New module:

```python
"""Wrap pianoplayer to annotate a music21 Stream with fingering numbers.

The rest of the backend is oblivious to the model: we return plain
ints attached to each ScoreNote so the protocol stays JSON-friendly.
"""
from music21 import stream as m21_stream
from pianoplayer.core import run_annotate

def annotate(stream: m21_stream.Score, depth: int = 9) -> dict[int, int]:
    """Return a map: id(note) -> finger number (1..5, negative for LH)."""
    # pianoplayer mutates the stream in place, adding
    # articulations.Fingering to each Note.
    run_annotate(stream, depth=depth)
    out: dict[int, int] = {}
    for n in stream.recurse().notes:
        f = next((a for a in n.articulations if a.classes[0] == "Fingering"), None)
        if f is not None:
            out[id(n)] = int(f.fingerNumber)
    return out
```

Hook into `score.py::build_score_from_payload`:

1. Build the Stream as today, but split notes into two `Part`s based on
   `staff` (right-hand staff → Part 1, left-hand staff → Part 2). The
   Stream must look like a real piano score for pianoplayer to infer
   hand assignments correctly.
2. Call `fingering.annotate(stream)`.
3. Store the finger on each `ScoreNote`:

```python
@dataclass(frozen=True)
class ScoreNote:
    pitch: int
    start_ms: float
    duration_ms: float
    track: int = 0
    staff: int = 0              # NEW
    finger: Optional[int] = None  # NEW: 1..5 for RH, -1..-5 for LH, None if unknown
```

Ship negative numbers for left hand to keep the encoding compact —
avoids adding a `hand` field and matches a convention used in some
pianoplayer outputs.

### Protocol

`score_timeline` frames grow the `finger` field per note. Existing
frontends ignore unknown fields, so this is backward compatible.

### Frontend

`front-end/src/renderer/waterfall.js` — when building each note mesh,
add a small text sprite *below* the bar:

- Digit 1..5 in a contrasting color (e.g. white on the coloured bar).
- Optional hand-colour cue: right hand = current cyan, left hand =
  a second accent (e.g. magenta).

Layout is the same pattern that `IMPROVEMENTS.md` uses for note-name
labels — see that doc for the actual sprite implementation; the
fingering label is just a second sprite with a different source string.

### Tests

- `test_fingering.py`: run a small fixture (C major scale, both hands)
  through the builder; assert every note gets a finger in [1, 5] for RH
  and [-1, -5] for LH; assert RH scale produces the expected 1-2-3-1-2-
  3-4-5 pattern within tolerance (pianoplayer is deterministic).
- `test_score.py`: backward-compat — a payload with no `staff` still
  builds a Score (defaults to staff 0, no fingering).

---

## What users should expect

- Scales and broken chords: near-perfect.
- Three-voice contrapuntal music (Bach fugue): noticeably mediocre,
  will sometimes place thumbs awkwardly.
- Jazz voicings, wide RH chords: OK, occasionally the software picks a
  finger that stretches past practical hand span.
- Pieces with editorial fingering already in the MusicXML: **we
  overwrite it by default.** Offer a toggle
  `--respect-existing-fingering` to prefer score-provided fingers and
  only fill gaps.

---

## Risks and trade-offs

- **New dependency.** pianoplayer pulls in a handful of transitive deps
  but nothing heavy (no torch, no native). Lock via `uv.lock`.
- **Determinism on score reloads.** pianoplayer is deterministic per
  input Stream. If the plugin sends the same notes in the same order,
  we get the same fingering. Good for caching.
- **Performance.** O(number of notes × depth²) — depth=9 default is the
  recommended value; a 5-minute piece runs in well under a second.
  Run off the event loop with `asyncio.to_thread` to be safe (relates
  to TD-01).
- **Quality floor.** Don't oversell in the UI. A small label "automatic
  fingering — not a substitute for your teacher" pre-empts
  disappointment and also sets us up to add "report wrong fingering"
  feedback later.

---

## Decision

Adopt **pianoplayer** (Option A) as the automatic fingering engine.
Ship it together with or shortly after the plugin's staff-aware
extraction fix, since both changes touch the same code path and
unblock each other.
