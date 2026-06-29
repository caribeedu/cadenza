# Cadenza migration — finish plan

Tracks remaining gaps vs [ChatGPT-Stack otimizada para Cadenza.txt](../ChatGPT-Stack%20otimizada%20para%20Cadenza.txt) and HAND-OFFS loop 14.

**Status key:** `done` | `in_progress` | `todo` | `deferred`

---

## A. UX polish

| ID | Item | Description | Status |
|----|------|-------------|--------|
| A1 | Event log panel | Scrollable log of score/MIDI/playback/validation/errors (plan PR 11 `EventLog`) | done |
| A2 | `app_error` event | Rust emits structured errors; UI listens and shows in log + banner | done |
| A3 | Empty-state hints | “Open MuseScore → run plugin → select MIDI” when no score / no MIDI | done |
| A4 | Composer in UI | Propagate `meta.composer` → `Timeline` → subtitle | done |
| A5 | `delta_ms` → waterfall | Forward validation timing to mood/backdrop tension | done |
| A6 | Piano colors per theme | CSS vars from active waterfall theme (`PIANO_KEY_CSS` parity) | done |
| A7 | HTTP ack `duration_ms` | `ScoreAck` includes timeline duration (plan Épico 2) | done |

---

## B. Plugin polish (PR 13)

| ID | Item | Description | Status |
|----|------|-------------|--------|
| B1 | QML copy | Replace “Python backend” with “Cadenza desktop app” | done |
| B2 | Connection errors | Clearer console message when app not running | done |

---

## C. Tests & fixtures (Fase 12)

| ID | Item | Description | Status |
|----|------|-------------|--------|
| C1 | `fixtures/invalid_bpm.json` | Negative/zero BPM → 400 | done |
| C2 | `fixtures/invalid_missing_pitch.json` | Malformed note → reject or skip | done |
| C3 | `fixtures/large-score.json` | Stress fixture (~80+ notes) | done |
| C4 | Protocol invalid tests | Deserialize + `build_timeline` error paths | done |
| C5 | `fire-pending-color.test.ts` | Gradient endpoints for low/high pitch | done |
| C6 | `event-log.test.ts` | Log ring-buffer helper | done |
| C7 | HTTP ingest test | `score_error_parts` + `AppErrorEvent` shape for invalid scores (`http_ingest.rs`) | done |
| C8 | Waterfall lifecycle test | `WaterfallRenderer` construct / setScore / destroy smoke (jsdom + mocked WebGL) | done |
| C9 | Component smoke tests | `EventLog` Solid `renderToString` mount | done |

---

## D. Performance & observability

| ID | Item | Description | Status |
|----|------|-------------|--------|
| D1 | Note instancing | `InstancedMesh` for large scores (plan Épico 7). **Limitation:** instanced path draws lava bars only — no finger sprites or note labels (see `NOTE_INSTANCING_THRESHOLD` in `instanced-note-bars.ts`). | done |
| D2 | `cadenza.log` file | Structured local log file | done |
| D3 | 60 FPS benchmark | Manual QA on large-score fixture | todo |

---

## E. Release QA (manual)

| ID | Item | Description | Status |
|----|------|-------------|--------|
| E1 | MuseScore send | Plugin → app with real score | todo |
| E2 | MIDI hardware | note_on/off, validation, held keys | todo |
| E3 | Clean shutdown | No orphan HTTP/MIDI on exit | todo |
| E4 | Installer smoke | `npm run tauri:build` on target OS | todo |

---

## Execution order (this session)

1. A2, A4, A5, A7 — Rust + App data plumbing  
2. A1, A2, A3 — Event log + empty states  
3. B1, B2 — Plugin copy  
4. C1–C7 — Fixtures + unit tests  
5. A6 — Piano theme CSS (if time)  
6. Update HAND-OFFS loop 15  

---

## Definition of done (finish)

- [x] All code items A1–D2 marked `done`
- [x] `npm test` (51) and `cargo test --lib` (28) green
- [x] `npm run build` green
- [ ] Manual checklist D3 + E1–E4 (user runs on hardware)
