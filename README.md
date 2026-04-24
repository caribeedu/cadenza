# Cadenza

[![Desktop Build](https://github.com/caribeedu/cadenza/actions/workflows/manual-desktop-build.yml/badge.svg)](https://github.com/caribeedu/cadenza/actions/workflows/manual-desktop-build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/caribeedu/cadenza)
[![Version](https://img.shields.io/badge/version-0.0.1-blue.svg)](https://github.com/caribeedu/cadenza/releases)

Open-source local piano practice app with live score validation. In classical music, a *cadenza* is the solo passage where the performer steps forward with technical freedom and expression. The name also echoes the idea of falling motion (*cadere*), matching the waterfall-style note visualization in the app.

Cadenza aims to be both:
- expressive practice software for real musicians, and
- a transparent OSS codebase that anyone can run, inspect, and improve.

And combines:
- a MuseScore 4 plugin that exports score data,
- a Python backend that validates MIDI in real time,
- an Electron desktop UI that renders a high-performance waterfall.

No account required. No score export files required. Everything runs locally.

## Main features

- Live waterfall visualization with Three.js in a desktop Electron app.
- Timeline scrubber with density preview for fast navigation through long pieces.
- Real-time note validation (`note_on`) against score timeline with tolerance window.
- Auto finger numbering for missing fingerings using backend fingering assignment.
- MIDI device listing and selection (USB/Bluetooth keyboards).
- MuseScore 4 plugin ingest path (HTTP) with tempo map support.
- Score timeline conversion to absolute milliseconds via `music21`.
- Practice controls for timing window (`Timing` slider) and replay speed (`Speed` slider).
- Theme selector for UI/waterfall look-and-feel presets.
- Low-latency backend architecture using async hub + thread-safe MIDI callbacks.
- Cross-platform packaging pipeline (Windows, macOS, Linux) with sidecar backend binary.
- Plugin auto-bundled in release artifacts and installed to MuseScore plugin directory.

## Architecture

```
MuseScore Plugin (QML) --> Python Hub (FastAPI/WebSocket) --> Electron UI (React + Three.js)
                                 ^
                                 |
                         MIDI keyboard input
```

Transport model:
- Plugin sends score payload to `http://127.0.0.1:8765/score` (HTTP).
- Frontend talks to `ws://127.0.0.1:8765/` (WebSocket).
- Backend broadcasts `score_timeline`, `status`, `midi_ports`, `note_played`.

## Repository layout

```
front-end/   Electron + React + Three.js desktop app
back-end/    Python 3.11 FastAPI hub, validator, MIDI engine
plugin/      MuseScore 4 QML plugin (Cadenza.qml)
```

Detailed setup docs:
- `front-end/README.md`
- `back-end/README.md`
- `plugin/README.md`

## Quick start (dev)

### 1) Start backend

```bash
cd back-end
uv sync --all-groups
uv run cadenza-server
```

### 2) Start desktop app

```bash
cd front-end
npm install
npm run dev
```

### 3) Install MuseScore plugin

Copy `plugin/Cadenza.qml` to MuseScore plugin directory:
- Linux: `~/.local/share/MuseScore/MuseScore4/Plugins/`
- macOS: `~/Documents/MuseScore4/Plugins/`
- Windows: `%USERPROFILE%\Documents\MuseScore4\Plugins\`

Enable plugin in MuseScore Plugin Manager, then run `Cadenza Sender`.

## Build desktop installers

Pipeline:
- Freeze backend with `PyInstaller`.
- Build Electron installers with `electron-builder`.
- Bundle plugin files into app resources.

### Local release build

Windows:

```powershell
cd back-end
./scripts/build-sidecar.ps1
cd ../front-end
npm run dist
```

macOS/Linux:

```bash
cd back-end
bash ./scripts/build-sidecar.sh
cd ../front-end
npm run dist
```

### GitHub Actions build

Use workflow: `Manual Desktop Build`
- builds Windows, macOS, Linux installers,
- uploads artifacts per OS.

## Quality and testing

Backend:

```bash
cd back-end
uv run pytest
```

Frontend:

```bash
cd front-end
npm test
```

## Project status

Current release: `0.0.1`

This is early but functional OSS foundation for local piano learning workflows.
Roadmap includes richer pedagogy feedback, better settings UX, and improved release ergonomics.

## Contributing

Issues and PRs welcome.

- Keep changes scoped and reviewable.
- Add/adjust tests with behavior changes.
- Prefer local-first and low-latency architecture.

## License

MIT.
