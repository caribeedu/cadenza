# Cadenza · MuseScore 4 Plugin (`plugin`)

A QML plugin for **MuseScore 4.x** that walks the current score with a
`Cursor`, extracts `pitch`, `offset` and `duration` (in quarter-note units),
and POSTs the resulting JSON payload to the **Cadenza desktop app** over
HTTP — no intermediate files are written.

## Why HTTP and not WebSocket?

MuseScore 4's bundled Qt runtime does **not** ship the `Qt.WebSockets`
QML module on Windows or macOS (confirmed error:
`module "Qt.WebSockets" is not installed`, see `TECH-DEBTS.md` TD-05).
`XMLHttpRequest` is part of the QtQml runtime itself and is always
available, so a plain HTTP POST is the most portable transport. The
Cadenza Tauri app listens on `127.0.0.1:8765` and pushes updates to the
SolidJS UI via Tauri events.

## File

- `Cadenza.qml` — the plugin. Imports only `QtQuick 2.9` and
  `MuseScore 3.0` (the QML plugin framework is still published under
  major version `3.0` on MuseScore Studio 4.x).

## Install

Copy `Cadenza.qml` to your MuseScore 4 plugins directory:

| OS       | Path                                                  |
| -------- | ----------------------------------------------------- |
| Linux    | `~/.local/share/MuseScore/MuseScore4/Plugins/`        |
| macOS    | `~/Documents/MuseScore4/Plugins/`                     |
| Windows  | `%USERPROFILE%\Documents\MuseScore4\Plugins\`         |

Then enable it in **Plugins → Plugin Manager** and **restart MuseScore**
(Manage Plugins' Reload does not always re-parse the QML file on Windows).

## Run

1. Start Cadenza: `npm run tauri:dev` (from repo root).
   The app binds HTTP ingest to `http://127.0.0.1:8765/score`.
2. Open a score in MuseScore 4 and run **Plugins → Cadenza Sender**.
3. The plugin POSTs a single JSON document to `http://127.0.0.1:8765/score`:

```json
{
  "type": "score",
  "bpm": 120.0,
  "notes": [
    { "pitch": 60, "offset_ql": 0.0, "duration_ql": 1.0, "track": 0 },
    { "pitch": 62, "offset_ql": 1.0, "duration_ql": 1.0, "track": 0 }
  ],
  "meta": { "title": "...", "composer": "...", "parts": 2 }
}
```

4. On `HTTP 200`, Cadenza converts quarter-length offsets into absolute
   milliseconds and updates the desktop UI timeline.

Cadenza answers with a short ack, e.g.
`{"ok": true, "notes": 128, "bpm": 120.0, "duration_ms": 64000.0}`. The
plugin logs it to the MuseScore log.

## Tests

Plugin behaviour is covered end-to-end in MuseScore. Score transformation,
validation, and HTTP ingest are tested in Rust (`cargo test` in `src-tauri/`)
and Vitest (`npm test` at repo root).

## Customising

- `backendUrl` (QML property at the top of `Cadenza.qml`) changes the
  ingest URL. Default: `http://127.0.0.1:8765/score`.
- The plugin only reads the first staff/voice per part (`track =
  partIdx * 4`). Adjust the loop in `collectNotes` if you need to
  include additional voices.

## Debugging

MuseScore 4 does not print QML `console.log` output to the terminal on
Windows; it writes it to a log file:

```
%LOCALAPPDATA%\MuseScore\MuseScore4\logs\MuseScore_YYMMDD_HHMMSS.log
```

On Linux/macOS, launching MuseScore from a terminal also surfaces the
log on stderr. Key lines to look for:

- `[Cadenza] collected N notes ... → POSTing to http://127.0.0.1:8765/score`
  — the plugin ran and built a payload.
- `[Cadenza] score accepted: {...}` — success (HTTP 200).
- `[Cadenza] connection failed — is the Cadenza app running?` — Cadenza
  is not listening on the configured URL/port.
- `[Cadenza] Cadenza rejected the score: 400 ...` — app reachable but
  payload rejected (invalid BPM, malformed JSON, etc.).

## Known failure mode: `module "Qt.WebSockets" is not installed`

If you are looking at older builds or an older version of this plugin
that imported `Qt.WebSockets 1.0`, MuseScore 4 on Windows / macOS fails
with this error. The fix is to use the current `Cadenza.qml` from this
folder — it no longer imports `Qt.WebSockets`.
