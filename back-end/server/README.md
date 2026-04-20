# Cadenza · Backend (`back-end/server`)

Python WebSocket hub that glues the **MuseScore plugin** (producer) and the
**Electron frontend** (visualizer). It also owns MIDI input so that keyboard
events are validated against the score in real time.

## Responsibilities

- WebSocket server on `ws://127.0.0.1:8765` (configurable) — this is
  the pipe to the Electron frontend.
- HTTP ingest on `http://127.0.0.1:8766/score` (configurable) — this is
  the pipe the MuseScore plugin uses. It exists because MuseScore 4 on
  Windows/macOS does not ship the `Qt.WebSockets` QML module (see
  `TECH-DEBTS.md` TD-05).
- Accepts score payloads from either transport and converts
  `quarterLength` offsets + tempo into an absolute millisecond timeline using
  `music21`.
- Enumerates MIDI input devices (USB / Bluetooth) via `mido` +
  `python-rtmidi`, opens the one the frontend selects, and pumps
  `note_on` events into an `asyncio.Queue`.
- Validates played notes against the score inside a tolerance window
  (default ±100 ms) and broadcasts verdicts to the frontend.
- Forwards the full timeline to the frontend so the waterfall can be drawn
  without any disk I/O on the score.

## Project layout

```
back-end/server/
├── pyproject.toml
├── README.md
├── .python-version
├── src/cadenza_server/
│   ├── __init__.py
│   ├── __main__.py      # `cadenza-server` CLI
│   ├── protocol.py      # JSON message type constants
│   ├── score.py         # music21-based timeline builder
│   ├── validator.py     # tolerance-based note matcher
│   ├── midi_input.py    # mido wrapper with an async queue
│   ├── http_ingest.py   # POST /score endpoint used by the MuseScore plugin
│   └── server.py        # websockets hub + HTTP ingest wiring
└── tests/
    ├── test_score.py
    ├── test_validator.py
    ├── test_protocol.py
    ├── test_http_ingest.py
    └── test_server_integration.py
```

## Prerequisites

- Python **3.11+** (managed automatically by `uv` via `.python-version`).
- [`uv`](https://docs.astral.sh/uv/) 0.5+.
- Linux/macOS/Windows. The `python-rtmidi` wheel depends on ALSA on Linux;
  on Debian/Ubuntu install `libasound2-dev` before the first `uv sync`.

## Install

```bash
cd back-end/server
uv sync --all-groups
```

This creates `.venv/`, resolves `uv.lock`, and installs both runtime and dev
dependencies (including `pytest`).

## Run the server

```bash
uv run cadenza-server
# or
uv run cadenza-server --host 0.0.0.0 --port 8765 --http-port 8766 --log-level DEBUG
```

On startup you should see two log lines:

```
INFO cadenza.http  : Cadenza HTTP ingest listening on http://127.0.0.1:8766
INFO cadenza.server: Cadenza server listening on ws://127.0.0.1:8765
```

Shut down with `Ctrl-C`.

## Run the unit tests

```bash
uv run pytest
```

Run a single module or select a test:

```bash
uv run pytest tests/test_validator.py
uv run pytest -k tolerance
```

## Protocol cheat sheet

All frames are JSON objects with a `type` key. WebSocket peers (frontend)
and the HTTP ingest (plugin) share the same payload schema.

| Direction | Type              | Payload                                        |
| --------- | ----------------- | ---------------------------------------------- |
| →         | `hello`           | `{ role: "plugin" \| "frontend" }`             |
| plugin →  | `score`           | `{ bpm, notes: [{pitch, offset_ql, duration_ql, track?}] }` — POSTed to `/score` via HTTP |
| front →   | `list_midi`       | —                                              |
| front →   | `select_midi`     | `{ port: "<name>" }`                           |
| front →   | `start` / `stop`  | —                                              |
| ← front   | `status`          | `{ midi_port, midi_open, playing, score_loaded, clients }` |
| ← front   | `midi_ports`      | `{ ports: [...] }`                             |
| ← front   | `score_timeline`  | `{ bpm, duration_ms, notes: [{pitch, start_ms, duration_ms, track}] }` |
| ← front   | `note_played`     | `{ correct, played_pitch, played_time_ms, expected_pitch, expected_time_ms, delta_ms }` |
| ← any     | `error`           | `{ error: "<message>" }`                       |

## Design notes

- All timing is computed in RAM. No `.mid` or `.xml` files are written — the
  plugin-to-backend-to-frontend pipeline only moves JSON over WebSockets.
- `mido` callbacks fire on a background thread; events are pushed to the
  asyncio loop with `loop.call_soon_threadsafe`, so the audio thread is
  never blocked by Python coroutines.
- The validator enforces single-match semantics so repeated presses of the
  same pitch won't consume the same scored note twice.
