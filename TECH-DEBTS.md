# Tech debts

Open debts carried over from the MVP. Ordered by blast radius, not age. Each
item states the symptom, the proposed fix, and a concrete verification
strategy so the work can be picked up without re-investigating.

Resolved debts are preserved at the bottom under **Shipped** with a short
one-liner pointing at the code that now addresses them, so future readers
can still follow the trail.

---

## (Currently no open tech debts — see Shipped below.)

---

## Explicitly *not* debts

- "Electron can't be GUI-tested in CI" — environment concern, not tech debt.
- "MIDI port hot-swap during playback" — covered by TD-01's async open; no
  separate work needed.

---

## Shipped

### TD-01 · Backend blocks the asyncio event loop on MIDI calls — *shipped*

All three synchronous call sites (`list_midi` handler, `select_midi`
handler, startup enumeration in `run()`) now route through
`list_input_ports_async` / `MidiInput.open_async` in
`back-end/src/cadenza_server/midi_input.py`. Each wraps the
blocking `python-rtmidi` call in `asyncio.to_thread(...)` guarded by
`asyncio.wait_for(timeout=3.0s)` and raises `MidiCallTimeout` on stall.

- Handler paths surface the timeout as a structured `error` frame instead
  of hanging the loop.
- Startup enumeration catches the timeout and keeps booting, so a wedged
  MIDI backend no longer prevents the WebSocket listener from accepting
  connections.

Regression tests: `back-end/tests/test_midi_input.py` →
`TestListInputPortsAsync` (includes a loop-responsiveness heartbeat
test) and `TestMidiInputOpenAsync`.

### TD-02 · Electron pre-warms BlueZ / Chromium Bluetooth on startup — *mitigated*

`front-end/src/main.js` appends
`--disable-features=WebBluetooth,BluetoothSerialPort` before
`app.whenReady()`. Not a full fix today (Chromium still initialises the
adapter in some configurations regardless), but shrinks the surface
area and is what upstream recommends until Electron ≥ 42 lands a
lazy-init fix. Tracked against that release.

### TD-03 · Score timeline is single-tempo only — *shipped*

- `plugin/Cadenza.qml` now walks the full score and emits
  `tempo_map: [{offset_ql, bpm}, ...]` alongside the scalar `bpm`.
  Duplicate offsets dedup last-wins, matching MuseScore's own
  rendering precedence.
- `back-end/src/cadenza_server/score.py` inserts one music21
  `MetronomeMark` per entry into the stream; `secondsMap` then
  resolves absolute timings across the piecewise tempo. Backward
  compatible: payloads without `tempo_map` still produce the previous
  single-tempo behaviour.

Regression tests: `back-end/tests/test_score.py` →
`TestTempoMap` (covers mid-piece tempo change, unsorted input,
duplicates, malformed entries, absent-map backward compat).

### TD-04 · Frontend waterfall can collide notes with identical key — *shipped*

- `ScoreNote` now carries a stable `id` (`back-end/.../score.py`),
  assigned in ingest order and included in `to_dict()`.
- `ValidationResult.to_dict()` emits `expected_id`
  (`back-end/.../validator.py`) for every outcome that
  identifies a target bar, including the Phase-2 penalty path.
- Frontend uses `noteMeshKey(note)` in `front-end/src/renderer/timeline.js`:
  prefers `id`, falls back to `(pitch, round(start_ms))` for legacy
  payloads. `WaterfallRenderer` builds and looks up its mesh map
  through this single helper so mesh creation and repaint can never
  disagree.

Regression tests: `back-end/tests/test_score.py` →
`TestScoreNoteIds` (covers id uniqueness, sub-millisecond grace-note
case, malformed-note gap handling); `back-end/tests/test_validator.py`
→ `test_to_dict_surfaces_expected_id_for_all_outcomes`; and
`front-end/test/timeline.test.mjs` → `noteMeshKey *` (covers id
preference, composite fallback, sentinel handling, sub-ms disambig).

### TD-05 · `Qt.WebSockets` runtime availability — *resolved*

Worked around by switching the plugin to plain HTTP POST via
`XMLHttpRequest` (see `plugin/Cadenza.qml`). No ongoing work.

### TD-06 · Frontend silently drops messages when the socket is closed — *shipped*

`front-end/src/renderer/ws-client.js` now buffers outbound messages
until the socket opens and flushes them *before* the `open` event
fires (so external listeners observe a consistent "we're live, and
everything you tried to send earlier is already on the wire" state).
Queue is bounded (default 32) and overflow emits `send-dropped` with
the discarded payload so `renderer.js` can surface it in the UI log
— no more silent "Refresh does nothing" during CSP / importmap
failures.

Regression tests: `front-end/test/ws-client.test.mjs` covers the
queue-while-closed, flush-in-order, live-send-after-open,
overflow-drops-oldest, reconnect-replays-queue, and
invalid-limit-rejected paths.
