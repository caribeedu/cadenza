# Cadenza current architecture

Tauri 2 desktop app (June 2026).

## Components

| Layer | Stack | Role |
|-------|-------|------|
| Plugin | MuseScore QML (`plugin/Cadenza.qml`) | Walks open score, POSTs JSON to `:8765/score` |
| Core | Rust (`src-tauri/`) | HTTP ingest, timeline, MIDI, validator, fingering |
| UI | SolidJS + Vite + Three.js (`src/`) | Waterfall, piano, scrubber, controls |

## Data flow

```
MuseScore QML  --HTTP POST /score-->  Rust hub (Tauri)  --Tauri events-->  SolidJS UI
                                           ^
                                           |
                                    MIDI keyboard
```

## Rust layout

```
src-tauri/src/
  http_ingest.rs     Axum POST :8765/score
  timeline.rs        ql → ms, tempo map
  validator.rs       4-phase note validation
  fingering_assign.rs + performer_fingering/
  midi.rs            midir input
  playback.rs        wall-clock playhead
  app_state.rs       hub state + Tauri events
  plugin_install.rs  copy QML to MuseScore
```

## Frontend layout

```
src/
  App.tsx              thin shell → AppProvider + AppShell
  app/
    useAppStore.ts     Tauri state, commands, event listeners
    AppProvider.tsx    Solid context
    AppShell.tsx       screen router (home | load | player)
    navigation.ts      routing helpers
    screens/           HomeScreen, LoadScreen, PlayerScreen, SettingsOverlay
  components/          Piano, Waterfall, TimelineScrubber, ui/, decor/
  styles/              design tokens, typography, shared components
  lib/waterfall/       Three.js renderer
  lib/piano-layout.ts  keyboard geometry
```

## Shared contract

- `fixtures/` — JSON score samples
- `docs/protocol-current.md` — plugin payload + events

## Dev

```bash
npm install
npm run tauri:dev
```

HTTP ingest starts automatically on `127.0.0.1:8765`.
