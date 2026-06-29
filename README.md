# Cadenza

[![Desktop Build](https://github.com/caribeedu/cadenza/actions/workflows/manual-desktop-build.yml/badge.svg)](https://github.com/caribeedu/cadenza/actions/workflows/manual-desktop-build.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/caribeedu/cadenza)
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/caribeedu/cadenza/releases)

Open-source local piano practice app with live score validation.

Cadenza combines:
- a **MuseScore 4 plugin** that exports score data over HTTP,
- a **Rust core** (Tauri) for timeline, MIDI, validation, and fingering,
- a **SolidJS + Three.js** desktop UI with waterfall visualization.

No account required. No score export files required. Everything runs locally.

## Main features

- Live waterfall visualization with Three.js.
- Timeline scrubber with density preview.
- Real-time note validation against score timeline with tolerance window.
- Auto finger numbering (Performer DP algorithm) for missing fingerings.
- MIDI device listing and selection.
- MuseScore plugin ingest on `POST http://127.0.0.1:8765/score`.
- Playback speed and tolerance sliders.
- One-click MuseScore plugin install from the app.

## Architecture

```
MuseScore Plugin (QML) --> Rust core (Tauri) --> SolidJS UI
                                ^
                                |
                         MIDI keyboard
```

## Repository layout

```
src/           SolidJS + Vite UI
src-tauri/     Rust core (HTTP, MIDI, validator, fingering)
plugin/        MuseScore 4 QML plugin
fixtures/      JSON score contract samples
docs/          protocol + architecture
```

## Quick start (dev)

```bash
npm install
npm run tauri:dev
```

The app starts the HTTP ingest server on `127.0.0.1:8765` automatically.

### Install MuseScore plugin

Use **Install plugin** in the app, or copy `plugin/Cadenza.qml` manually:

| OS      | Path                                           |
| ------- | ---------------------------------------------- |
| Linux   | `~/.local/share/MuseScore/MuseScore4/Plugins/` |
| macOS   | `~/Documents/MuseScore4/Plugins/`              |
| Windows | `%USERPROFILE%\Documents\MuseScore4\Plugins\` |

Restart MuseScore, enable the plugin, then run **Plugins → Cadenza Sender**.

### Load a test score

```bash
curl -X POST http://127.0.0.1:8765/score \
  -H 'Content-Type: application/json' \
  -d @fixtures/simple-scale.json

# Stress / instancing path (88 notes):
curl -X POST http://127.0.0.1:8765/score \
  -H 'Content-Type: application/json' \
  -d @fixtures/large-score.json
```

Scores with 60+ notes use instanced waterfall bars automatically.

## Local log file

The Rust core appends structured lines to `cadenza.log` in the Tauri app log directory (e.g. `~/.local/share/.../logs/cadenza.log` on Linux). Events include score ingest, playback, validation, and errors.

## Build release installer

```bash
npm run tauri:build
```

Artifacts land in `src-tauri/target/release/bundle/`.

### GitHub Actions

Workflow **Manual Desktop Build** builds Windows, macOS, and Linux installers.

## Testing

```bash
npm test                  # Vitest — shared UI libs
cd src-tauri && cargo test  # Rust — timeline, validator, fingering, MIDI
```

## License

MIT.
