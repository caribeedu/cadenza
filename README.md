# Cadenza

**Cadenza** is a local "waterfall" piano trainer in the spirit of Yousician or Simply Piano. A MuseScore 4 plugin streams the active score into a Python backend that validates MIDI against the score in real time, while the desktop UI renders falling notes with Three.js.

## Why "Cadenza"?

In classical music, a **cadenza** is the solo passage where the player steps forward—technically demanding, personal, and immediate. The name also echoes *cadere* (Latin "to fall"), which fits the way notes cascade toward the keyboard in the UI. It is a nod to both expression and the falling-note metaphor.

## Open source & free

Cadenza is **open-source** and **free to use**. The code is published under a permissive license (see the repository’s `LICENSE` if present, or `back-end/server/pyproject.toml` for the backend’s stated license). No paywall for practice—fork it, run it locally, and improve it with us.

## Layout

```
front-end/              Electron + Three.js visualiser
back-end/
├── plugin/             MuseScore 4 QML plugin (producer)
└── server/             Python 3.11 backend — uv-managed
```

The stack may grow (for example **FastAPI** and **React**) while keeping front-end, back-end, and plugin in this single repo.

Each sub-folder has its own README with install, run, and test instructions.

## Quick start

```bash
# 1. Backend (requires uv)
cd ./back-end/server
uv sync --all-groups
uv run cadenza-server

# 2. Frontend (requires Node 20+)
cd ./front-end
npm install
npm start

# 3. MuseScore plugin
cp ./back-end/plugin/Cadenza.qml <destination-path>
# then enable "Cadenza Sender" in MuseScore's Plugin Manager
```

## Architecture

```
MuseScore QML plugin  ──ws──▶  Python backend  ──ws──▶  Electron frontend
                                       ▲
                                       │ note_on events (async queue)
                               mido + python-rtmidi
                                       │
                              MIDI keyboard (USB / BT)
```

- All payloads are JSON over WebSocket — nothing is ever persisted.
- The backend uses `music21`'s `secondsMap` to convert score offsets
  (quarter lengths) into absolute millisecond timings.
- MIDI callbacks run on a background thread and are bounced into the
  asyncio loop with `loop.call_soon_threadsafe`.
- Validation uses a configurable tolerance window (default ±100 ms) and
  never matches the same scored note twice.

## Tests

```bash
# Python
cd ./back-end/server && uv run pytest

# JavaScript
cd ./front-end && npm test
```
