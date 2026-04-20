# Cadenza · MuseScore 4 Plugin (`plugin`)

A QML plugin for **MuseScore 4.x** that walks the current score with a
`Cursor`, extracts `pitch`, `offset` and `duration` (in quarter-note units),
and POSTs the resulting JSON payload to the Cadenza Python backend over
HTTP — no intermediate files are written.

## Why HTTP and not WebSocket?

MuseScore 4's bundled Qt runtime does **not** ship the `Qt.WebSockets`
QML module on Windows or macOS (confirmed error:
`module "Qt.WebSockets" is not installed`, see `TECH-DEBTS.md` TD-05).
`XMLHttpRequest` is part of the QtQml runtime itself and is always
available, so a plain HTTP POST is the most portable transport. The
backend still speaks WebSockets to the Electron frontend — the plugin
just feeds the hub through a different door.

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

1. Start the backend: `cd back-end/server && uv run cadenza-server`.
   This opens **two** local listeners:
   - `ws://127.0.0.1:8765` — WebSocket hub for the Electron frontend.
   - `http://127.0.0.1:8766/score` — HTTP ingest for this plugin.
2. Open a score in MuseScore 4 and run **Plugins → Cadenza Sender**.
3. The plugin POSTs a single JSON document to `http://127.0.0.1:8766/score`:

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

4. On `HTTP 200`, the backend converts `offset_ql` / `duration_ql` into
   absolute milliseconds using `music21`'s tempo-aware `secondsMap` and
   forwards the resulting timeline to the Electron frontend as a
   `score_timeline` WebSocket frame.

The backend answers with a short ack, e.g.
`{"ok": true, "notes": 128, "bpm": 120.0}`. The plugin logs it to the
MuseScore log.

## Unit tests

The plugin is QML and is exercised end-to-end by loading it inside
MuseScore. Core data-transformation logic (tempo scaling, validation,
payload normalisation, HTTP ingest) lives in the Python backend and is
covered by `back-end/server`'s `pytest` suite — run `uv run pytest` from
`back-end/server/` to execute it. The HTTP ingest path is covered by
`tests/test_http_ingest.py` and
`tests/test_server_integration.py::test_plugin_score_via_http_reaches_frontend_as_timeline`.

## Customising

- `backendUrl` (QML property at the top of `Cadenza.qml`) changes the
  target URL. Default: `http://127.0.0.1:8766/score`.
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

- `[Cadenza] collected N notes ... → POSTing to http://127.0.0.1:8766/score`
  — the plugin ran and built a payload.
- `[Cadenza] score accepted by backend: {...}` — success (HTTP 200).
- `[Cadenza] connection failed — is the backend running ...` — the
  backend is not listening on the configured URL/port.
- `[Cadenza] backend rejected payload: 400 ...` — backend reachable but
  payload rejected (unknown type, invalid JSON, etc.).

## Known failure mode: `module "Qt.WebSockets" is not installed`

If you are looking at older builds or an older version of this plugin
that imported `Qt.WebSockets 1.0`, MuseScore 4 on Windows / macOS fails
with this error. The fix is to use the current `Cadenza.qml` from this
folder — it no longer imports `Qt.WebSockets`.
