# Cadenza · Front-end (`front-end/`)

Electron desktop app. Renderer is a **React 19** tree built with **Vite**
(via `electron-vite`); the visualiser itself still paints on a Three.js
`WebGLRenderer` under an `OrthographicCamera`. The renderer is hardened
(`contextIsolation: true`, `nodeIntegration: false`, sandboxed preload,
CSP) while the main process owns the Bluetooth mitigation
(`TECH-DEBTS.md → TD-02`).

## Prerequisites

- Node.js **20.19+** or **22.12+** (required by electron-vite and Vite 6).
- A GPU capable of running WebGL.
- The Cadenza backend (`back-end`) for live data.

## Install

```bash
cd front-end
npm install
```

## Scripts

| Command              | Purpose                                             |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Vite dev server + Electron with renderer HMR       |
| `npm run build`      | Production build (main + preload + renderer)       |
| `npm run dist`       | Build Windows installer via `electron-builder`     |
| `npm run preview`    | Launch Electron against the last production build  |
| `npm start`          | Alias of `preview`                                 |
| `npm test`           | Run the Vitest suite once                          |
| `npm run test:watch` | Re-run tests on file changes                       |

`npm run dist` expects a frozen backend binary in
`front-end/release/backend/`:

- `cadenza-server.exe` on Windows
- `cadenza-server` on macOS/Linux

In packaged builds, the Electron main process auto-spawns this sidecar from
`resources/backend` and stops it on app exit.

## Project layout

```
front-end/
├── electron.vite.config.ts     # main / preload / renderer build configs
├── vitest.config.ts            # test config, aliases shared with renderer
├── vitest.setup.ts             # Vitest + jest-dom matchers
├── package.json
└── src/
    ├── main/                   # Electron main process (ESM)
    │   └── index.ts
    ├── preload/                # contextBridge; emitted as CJS for sandbox:true
    │   └── index.ts
    └── renderer/
        ├── index.html          # Vite renderer entry
        ├── main.tsx            # React.createRoot
        ├── App.tsx             # top-level composition
        ├── app/
        │   ├── constants.ts    # defaults (backend URL, tolerance bounds, palette)
        │   └── providers/
        │       ├── AppProviders.tsx       # composition root for context
        │       ├── EventLogProvider.tsx
        │       ├── ScoreConfigProvider.tsx  # tolerance / palette / viz mode
        │       ├── WebSocketProvider.tsx
        │       └── PlaybackProvider.tsx     # mirrors server status + actions
        ├── features/
        │   ├── player/          # waterfall + piano + top bar composition
        │   ├── midi/            # MIDI port selection
        │   ├── websocket/       # backend URL input
        │   ├── score-config/    # tolerance slider today; velocity/colour later
        │   ├── settings/        # placeholder for the upcoming settings page
        │   └── visualization/   # mode dropdown (waterfall today)
        ├── shared/
        │   ├── components/      # cross-feature UI (StatusChip, LogPanel) + *.test.tsx
        │   ├── hooks/           # useElementSize, useEventTarget
        │   ├── lib/             # pure utilities (timeline, piano-layout,
        │   │                    #   protocol, ws-client, …) + colocated *.test.ts
        │   └── styles/          # tokens.css + globals.css
        └── types/               # reserved for JSDoc typedefs
```

Path aliases (`@app`, `@features`, `@shared`, `@styles`) are defined in
both the Vite config and the Vitest config so imports stay the same in
tests.

## Data flow

1. `WebSocketProvider` owns a single `CadenzaClient` instance and
   publishes `status`, `backendUrl`, `reconnect`, `send`, `subscribe`.
2. `PlaybackProvider` subscribes to server messages, runs a reducer
   for `status` / `midi_ports` / `score_timeline` / `note_played`, and
   exposes imperative actions (`start`, `togglePause`, `selectMidi`,
   `commitTolerance`, ...).
3. `ScoreConfigProvider` holds the slider / palette / visualisation
   mode state.
4. `EventLogProvider` keeps the rolling 200-line diagnostic buffer.

The `<Waterfall>` component measures the piano strip with
`useElementSize`, feeds the width into `useKeyboardLayout` to build a
memoised piano layout, and hands the resulting `laneCenterPx` /
`laneWidthPx` facade to the Three.js `WaterfallRenderer`. The
`<Piano>` component reads the same layout so bars and keys stay
aligned to the pixel.

## Testing

Tests use **Vitest** (+ **@testing-library/react** for components). The
default environment is `node`; component tests opt into `jsdom` with:

```js
// @vitest-environment jsdom
```

Run everything:

```bash
npm test
```

Tests live next to the modules they cover (e.g. `timeline.test.ts` beside
`timeline.ts`). Coverage includes pure utilities, `playback-reducer`,
`useWaterfall`, and component smoke tests (`StatusChip`, `LogPanel`).

## Security / hardening

Renderer:

```js
contextIsolation: true,
nodeIntegration: false,
sandbox: true,
preload: "out/preload/index.js",
```

CSP meta tag (in `src/renderer/index.html`) locks script/style
sources to `'self'` (with `'unsafe-inline'` / `'unsafe-eval'` needed
only for Vite's HMR during dev), allows WebSocket connections to
`ws://127.0.0.1:*` / `ws://localhost:*`, and permits the backend
HTTP loopback for the MuseScore plugin's POST.

The preload exposes a single constant
(`window.cadenza.defaultBackendUrl`) — everything else is reached
through that constant or the WebSocket.
