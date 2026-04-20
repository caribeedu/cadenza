# Cadenza · Back-end

The back-end is split into two deliverables:

| Folder    | Component                                                                |
| --------- | ------------------------------------------------------------------------ |
| `server/` | Python 3.11+ WebSocket hub, MIDI input, score validator (managed by `uv`)|
| `plugin/` | MuseScore 4 QML plugin that streams the open score to the server         |

Each sub-folder has its own `README.md` with step-by-step install, run, and
test instructions.

## Quick start

```bash
# 1. Install + run the server
cd back-end/server
uv sync --all-groups
uv run cadenza-server

# 2. In another terminal, copy the plugin into MuseScore's plugin folder
cp plugin/Cadenza.qml ~/.local/share/MuseScore/MuseScore4/Plugins/
```

Then enable **Cadenza Sender** in MuseScore's Plugin Manager, open a score
and launch the plugin. The backend will forward the timeline to the
Electron frontend (see `../front-end`).

## Data flow

```
MuseScore QML plugin  ──ws──▶  Python backend  ──ws──▶  Electron frontend
                                       ▲
                                       │ note_on events
                               mido + python-rtmidi
                                       │
                              MIDI keyboard (USB / BT)
```

All communication is JSON over WebSocket; no `.mid` or `.xml` files are
ever persisted during a session.

## Running the back-end test suite

```bash
cd back-end/server
uv run pytest
```
