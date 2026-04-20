# Auto-Sync · Feasibility and plan

## TL;DR

**Yes, auto-sync is feasible and strongly recommended** for Cadenza. The
current pipeline only supports *Performance Mode* (fixed wall-clock
after **Start**). We should add a *Practice Mode* that waits for the
player — the single highest-leverage UX change after the MVP, and the
default mode in Yousician / Simply Piano / Synthesia.

A full *Elastic Tempo Mode* (score follower with continuous tempo
tracking) is also feasible but is a 10× more complex project. Not
recommended as a next step; revisit once Practice Mode is in.

---

## What "auto-sync" means

Three mutually exclusive operating modes, not one feature:

| Mode            | Clock source                     | Wrong-note behaviour      | Yousician analog           |
| --------------- | -------------------------------- | ------------------------- | -------------------------- |
| Performance     | Wall-clock since **Start**       | Flagged, clock marches on | "Perform" / "full tempo"   |
| Practice        | Advances only on correct note(s) | Cursor stalls until fixed | Default Learn mode         |
| Elastic Tempo   | Wall-clock, continuously warped  | Flagged, tempo adapts     | "Play along" w/ follow-me  |

Today we implement only **Performance**. The request is for **Practice**
and optionally **Elastic**.

---

## Current state audit

Relevant files:

- `back-end/src/cadenza_server/server.py` — on `MSG_START`
  calls `self._midi.mark_time_zero()` and flips `playing = True`. From
  that moment MIDI events carry `timestamp_ms = now - t0`.
- `back-end/src/cadenza_server/validator.py` — `Validator.validate(pitch, played_time_ms)`
  finds the nearest unconsumed note within `tolerance_ms` (100 ms).
  Time is treated as ground truth; the validator is a pure function of
  `(pitch, time)`.
- `back-end/src/cadenza_server/score.py` — `ScoreNote.start_ms`
  is absolute from t=0 at the score's BPM.
- `front-end/src/renderer/waterfall.js` — renders at `pxPerMs` against
  a wall-clock running in the frontend; animation is driven by
  `requestAnimationFrame` and the internal clock mirrors the backend's.

Implication: the whole system is timestamped-hit-against-fixed-timeline.
Auto-sync needs a **second, orthogonal concept** — a *playback cursor*
that is not a wall-clock — or the wall-clock has to become a derived
quantity.

---

## Practice Mode (recommended next step)

### Algorithm: beat-group cursor

Group notes by `start_ms` into ordered *beat groups*. A beat group is
either a single note or a chord (all notes with the same start time
within a small epsilon, say 5 ms).

```
groups = [
  { time: 0.0,   pitches: {60} },           # C
  { time: 500.0, pitches: {64, 67} },       # chord E+G
  { time: 1000,  pitches: {62} },           # D
  ...
]
```

State: `cursor` (index into `groups`) and `pending = set(groups[cursor].pitches)`.

On each incoming MIDI `note_on`:

1. If `pitch in pending`:
   - Remove it from `pending`.
   - Emit `note_played { correct: true }`.
   - If `pending` now empty: advance `cursor`, reset `pending` to next group, emit `cursor_advanced` with new score time.
2. Else:
   - Emit `note_played { correct: false, expected = any from pending }`.
   - Don't advance.

### Handling user mistakes

- Extra wrong note: flagged, cursor stalls. Matches Yousician.
- "Skip ahead": if the same wrong pitch arrives *twice*, or after a
  timeout, offer an "unstuck" hint — highlight the missing note, do not
  auto-advance. (Unlike Simply Piano, which sometimes advances. We
  should err conservative for beginners.)
- Timing within a beat group: we ignore timing — chord notes can be
  struck in any order, even slightly apart. Tolerance window is
  irrelevant in Practice.

### Protocol changes

New messages (additive, backward compatible):

| Direction          | Type             | Payload                                    |
| ------------------ | ---------------- | ------------------------------------------ |
| frontend →         | `set_mode`       | `{ mode: "practice" \| "performance" }`    |
| ← frontend         | `cursor`         | `{ group_index, score_time_ms, pending }`  |

`status` frame extended with `mode`.

### Backend changes

New module `back-end/src/cadenza_server/follower.py`:

```python
class ScoreFollower:
    def __init__(self, score: Score, epsilon_ms: float = 5.0) -> None: ...
    def reset(self) -> None: ...
    def on_note(self, pitch: int) -> FollowerUpdate: ...
    @property
    def cursor(self) -> int: ...
    @property
    def score_time_ms(self) -> float: ...
```

`Validator` keeps its place for Performance Mode. The server picks which
one to feed MIDI into based on `self._state.mode`.

### Frontend changes

- `waterfall.js` gains two rendering clocks:
  - **Performance clock** (current): wall-clock mirror.
  - **Practice clock**: `currentTimeMs = lastCursorTimeMs` (static until
    the backend advances it). The waterfall looks like a paused tape
    that jumps forward when the cursor advances.
- Add a small animation on advance (ease over ~120 ms) so the jump is
  smooth instead of teleporting.
- Mode toggle in the topbar.

### Effort estimate

- Backend follower + tests: ~1 day.
- Protocol + server glue: ~0.5 day.
- Frontend dual-clock + mode toggle + animation polish: ~1 day.

Total **~2.5 days** for a crisp, Yousician-grade Practice Mode.

### Tests to add

1. `test_follower.py` unit tests:
   - Single-note sequence advances one step per correct pitch.
   - Chord beat-group: requires all pitches; order doesn't matter;
     stalls on partial.
   - Wrong pitch: does not advance; repeated wrong pitches do not
     accumulate state.
   - Reset clears state.
2. Integration: MIDI events in Practice Mode yield `cursor` frames in
   the expected order; Performance Mode still produces timed
   `note_played` frames.

---

## Elastic Tempo Mode (future, NOT recommended as next step)

### What it means

Wall-clock still advances, but the *expected* time of each note is
warped by an estimated tempo. If the player is consistently 200 ms late,
the playback slows 10 %; if they accelerate, it speeds up.

### Why it's hard

- Needs a **score follower** (probabilistic state tracker): Hidden
  Markov Model over score positions, with observation = MIDI stream.
  Classic references: Cont, Raphael, Nakamura. Real implementations:
  Antescofo, Music Plus One, ScoreFollower.
- Needs to be robust to:
  - Ornamentation and trills the score doesn't have.
  - Dropped notes (player skipped a note).
  - Repeated notes (player hesitated and repeated one).
  - Chord arpeggiation.
- Latency/stability tradeoff: react too fast = jittery tempo, react too
  slow = feels unresponsive.

### Minimum viable version

Not an HMM — a running linear-regression over the last N beat
groups: treat each correctly-played group as a (score_time, wall_time)
sample and fit slope = tempo multiplier. Works if the player mostly
plays correctly but is bad under heavy errors.

### Why it's not the right next step

- Practice Mode already delivers 80 % of the user-visible benefit.
- A partial Elastic Tempo that regresses on edge cases is *worse* than
  Performance Mode, because the visual timeline becomes unpredictable.
- Research-grade followers are integration-heavy; we'd be on the hook
  for tuning parameters forever.

Revisit once Practice Mode is shipped and we have real user feedback
pointing at "I want to play at my own tempo but still see the music
move".

---

## Risks and trade-offs

- **Practice Mode changes the "correctness over time" semantics.** The
  current validator's tolerance window is meaningless in Practice; if
  we ever reuse the validator for offline scoring, we need a wall-clock
  snapshot.
- **Beat-group epsilon (5 ms) is a magic number.** Music21's timing can
  emit tiny rounding differences. Needs a quick scan of real scores to
  confirm 5 ms is enough.
- **Chord ordering across hands:** a two-hand chord may have the left
  hand's notes appear on `track=1` and right on `track=0`. The beat
  group should not be partitioned by track — group by `start_ms` only.
- **Tech-debt interaction:** TD-03 (single-tempo only) becomes more
  visible once the cursor shows a live score time; once we support
  multi-tempo scores we must rebuild beat groups on tempo-change
  boundaries as well as start times. Practice Mode already handles
  multi-tempo correctly because it ignores wall-clock — so TD-03 stays
  invisible in Practice but will re-surface in Elastic Tempo.

---

## Decision

Implement **Practice Mode** as the immediate next feature. Defer
Elastic Tempo Mode until there is a signal from real usage that the
static-tempo "Perform" button is limiting.
