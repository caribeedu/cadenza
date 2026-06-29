# Cadenza protocol (current stack)

Contract between the MuseScore plugin, the Rust core (Tauri), and the
SolidJS desktop UI.

## Plugin → core (HTTP)

**Endpoint:** `POST http://127.0.0.1:8765/score`  
**Content-Type:** `application/json`

### Score payload

```typescript
type ScorePayload = {
  type?: "score"; // defaults to "score" when omitted
  bpm?: number;   // default 120; used at offset 0 when tempo_map is empty
  tempo_map?: Array<{
    offset_ql: number;
    bpm: number;
  }>;
  notes: Array<{
    pitch: number;
    offset_ql: number;
    duration_ql: number;
    track?: number;
    staff?: number;
    finger?: number; // 1–5 when present in MuseScore
  }>;
  meta?: {
    title?: string;
    composer?: string;
    parts?: number;
  };
};
```

### Success response (HTTP 200)

```json
{ "ok": true, "notes": 123, "bpm": 120.0, "duration_ms": 48000.0 }
```

### Error response (HTTP 400)

```json
{ "error": "bpm must be positive" }
```

On error the core also emits an `app_error` Tauri event:

```typescript
type AppErrorEvent = {
  code: string;       // e.g. "invalid_bpm"
  message: string;
  recoverable: boolean;
};
```

## Core → UI (Tauri events)

| Event | Payload highlights |
|-------|-------------------|
| `score_loaded` | `Timeline` — `bpm`, `title?`, `composer?`, `duration_ms`, `notes[]` |
| `playback_changed` | `playing`, `paused`, `position_ms`, `speed` |
| `validation_result` | `correct`, `played_pitch`, `delta_ms?`, `expected_*` |
| `midi_note` / `midi_note_off` | Live MIDI input |
| `midi_ports_changed` | `ports[]`, `selected?` |
| `fingering_progress` | Performer DP progress |
| `app_error` | See above |

### Timeline (`score_loaded`)

```typescript
type Timeline = {
  bpm: number;
  title?: string;
  composer?: string;
  duration_ms: number;
  notes: Array<{
    id: number;
    pitch: number;
    start_ms: number;
    duration_ms: number;
    track: number;
    staff: number;
    finger?: number;
  }>;
};
```

## Core → UI (Tauri commands)

`get_status`, `select_midi`, `play`, `pause`, `resume`, `stop`, `seek`,
`set_speed`, `set_tolerance`, `ping`, `install_muse_score_plugin`.

## Local log file

Append-only `cadenza.log` in the Tauri app log directory. Events include
`score_received`, `playback_*`, `validation_result`, `app_error`.
