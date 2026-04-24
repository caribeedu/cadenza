# Cadenza · Back-end

FastAPI hub that glues the **MuseScore plugin** (producer) and the
**Electron frontend** (visualizer). It also owns MIDI input so that
keyboard events are validated against the score in real time.

## Responsibilities

- **Single port, single app.** Everything is served by one FastAPI
  instance on `127.0.0.1:8765` (configurable):
  - `ws://127.0.0.1:8765/` — WebSocket endpoint consumed by the
    Electron frontend.
  - `http://127.0.0.1:8765/score` — HTTP ingest endpoint consumed by
    the MuseScore plugin (see `TECH-DEBTS.md` TD-05 for why the plugin
    can't use WebSockets).
- Converts `quarterLength` offsets + tempo into an absolute millisecond
  timeline using `music21`.
- Enumerates MIDI input devices (USB / Bluetooth) via `mido` +
  `python-rtmidi`, opens the one the frontend selects, and pumps
  `note_on` events into an `asyncio.Queue`.
- Validates played notes against the score inside a tolerance window
  (default ±100 ms) and broadcasts verdicts to the frontend.

## Project layout

```
back-end/
├── pyproject.toml
├── README.md
├── .python-version
├── src/cadenza_server/
│   ├── __init__.py            # public re-exports (backwards-compat)
│   ├── __main__.py            # `cadenza-server` CLI → uvicorn.run(create_app())
│   ├── logging_config.py
│   ├── app/                   # composition root
│   │   ├── config.py          # AppConfig dataclass
│   │   ├── lifespan.py        # FastAPI lifespan: start/stop Hub
│   │   └── factory.py         # create_app(config) → FastAPI
│   ├── core/                  # pure domain, no transport imports
│   │   ├── protocol.py        # MessageType (StrEnum) + encode/decode
│   │   ├── score.py           # ScoreNote, Score, build_score_from_payload
│   │   └── validator.py       # Validator, ValidationResult, unvalidated_reason
│   └── features/
│       ├── midi/              # MidiInput, MidiEvent, async enum/open helpers
│       ├── hub/               # HubState + Hub service (transport-agnostic)
│       └── api/               # FastAPI routers (ws_router, score_router) + schemas
└── tests/
    ├── conftest.py
    ├── core/                  # tests for core/
    ├── features/              # tests for features/midi/
    └── api/                   # FastAPI TestClient integration tests
```

The clean-arch boundary is strict: `core/` never imports from `features/`
or `app/`, and `features/hub/` never imports FastAPI. The only place the
ASGI framework is visible is `features/api/*_router.py` and
`app/factory.py`.

## Prerequisites

- Python **3.11+** (managed automatically by `uv` via `.python-version`).
- [`uv`](https://docs.astral.sh/uv/) 0.5+.
- Linux/macOS/Windows. The `python-rtmidi` wheel depends on ALSA on Linux;
  on Debian/Ubuntu install `libasound2-dev` before the first `uv sync`.

## Install

```bash
cd back-end
uv sync --all-groups
```

This creates `.venv/`, resolves `uv.lock`, and installs both runtime and
dev dependencies (`fastapi`, `uvicorn`, `pytest`, `httpx`, `ruff`, `mypy`).

## Run the server

```bash
uv run cadenza-server
# or with explicit options
uv run cadenza-server --host 0.0.0.0 --port 8765 --log-level DEBUG
```

On startup you should see:

```
INFO cadenza.cli : Cadenza listening on ws://127.0.0.1:8765/ and http://127.0.0.1:8765/score
INFO cadenza.hub : Cadenza hub online
```

Shut down with `Ctrl-C`.

## Quality gates

```bash
uv run pytest                # unit + integration tests
uv run ruff check .          # lint (imports, bugbear, pyupgrade, simplify, pytest-style)
uv run ruff format --check . # formatting
uv run mypy src              # strict type-check
```

## Build distributable

To generate packaged sidecar binary used by desktop releases:

```powershell
cd back-end
./scripts/build-sidecar.ps1
```

Output:

- `back-end/dist/cadenza-server.exe`
- copied to `front-end/release/backend/cadenza-server.exe` for installer bundling

macOS/Linux:

```bash
cd back-end
bash ./scripts/build-sidecar.sh
```

Output:

- `back-end/dist/cadenza-server`
- copied to `front-end/release/backend/cadenza-server` for installer bundling

Run a single test module or select a test:

```bash
uv run pytest tests/core/test_validator.py
uv run pytest -k tolerance
```

## Protocol cheat sheet

All frames are JSON objects with a `type` key (modelled server-side as a
`MessageType` StrEnum). WebSocket peers and the HTTP ingest share the
same payload schema.

| Direction | Type              | Payload                                        |
| --------- | ----------------- | ---------------------------------------------- |
| →         | `hello`           | `{ role: "plugin" \| "frontend" }`             |
| plugin →  | `score`           | `{ bpm, notes: [{pitch, offset_ql, duration_ql, track?}] }` — POSTed to `/score` via HTTP |
| front →   | `list_midi`       | —                                              |
| front →   | `select_midi`     | `{ port: "<name>" }`                           |
| front →   | `start` / `pause` / `resume` / `stop` | —                          |
| front →   | `set_tolerance`   | `{ tolerance_ms: <number> }`                   |
| ← front   | `status`          | `{ midi_port, midi_open, playing, paused, score_loaded, tolerance_ms, clients }` |
| ← front   | `midi_ports`      | `{ ports: [...] }`                             |
| ← front   | `score_timeline`  | `{ bpm, duration_ms, notes: [{id, pitch, start_ms, duration_ms, track}] }` |
| ← front   | `note_played`     | `{ correct, played_pitch, played_time_ms, expected_id, expected_pitch, expected_time_ms, delta_ms, reason? }` |
| ← any     | `error`           | `{ error: "<message>" }`                       |

FastAPI auto-publishes an OpenAPI schema for the HTTP surface at
`http://127.0.0.1:8765/docs` — useful while developing the plugin.

## Design notes

- All timing is computed in RAM. No `.mid` or `.xml` files are written —
  the plugin → backend → frontend pipeline only moves JSON over
  WebSocket + HTTP.
- `mido` callbacks fire on a background thread; events are pushed to the
  asyncio loop with `loop.call_soon_threadsafe`, so the audio thread is
  never blocked by Python coroutines.
- The validator enforces single-match semantics so repeated presses of
  the same pitch won't consume the same scored note twice.
- The `Hub` service is transport-agnostic: tests can drive it by faking
  a `ClientConnection` in ~20 lines, and a future gRPC or SSE transport
  would re-use the same service unmodified.
