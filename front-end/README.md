# Cadenza · Front-end (`front-end/`)

Electron + Three.js visualiser. The main process hardens the renderer
(`contextIsolation: true`, `nodeIntegration: false`, sandboxed preload) and
the renderer paints the waterfall on a `WebGLRenderer` driven by an
`OrthographicCamera`.

## Project layout

```
front-end/
├── package.json
├── README.md
└── src/
    ├── main.js            # Electron main process (ESM)
    ├── preload.cjs        # Sandboxed preload (exposes defaultBackendUrl)
    └── renderer/
        ├── index.html     # Imports three via native importmap
        ├── renderer.js    # UI glue: binds DOM → WS client → waterfall
        ├── ws-client.js   # Auto-reconnecting WebSocket helper
        ├── protocol.js    # JSON message-type constants (mirror of Python)
        ├── timeline.js    # Pure note→pixel math (unit tested)
        ├── waterfall.js   # Three.js scene + animation loop
        └── styles.css
└── test/
    ├── timeline.test.mjs
    ├── protocol.test.mjs
    └── ws-client.test.mjs
```

## Prerequisites

- Node.js **20 LTS** or newer (the project uses ESM main-process support
  added in Electron 28+).
- A GPU capable of running WebGL (any modern desktop GPU works).
- The Cadenza backend running (`back-end/server`).

## Install

```bash
cd front-end
npm install
```

## Run the app

```bash
npm start
```

The app opens the Cadenza window and immediately tries to connect to
`ws://127.0.0.1:8765` (the default backend URL; override it in the top-bar
input field). The top-bar shows live status chips for the WebSocket,
selected MIDI device, and score state.

### Typical end-to-end session

1. `cd back-end/server && uv run cadenza-server` in one terminal.
2. `cd front-end && npm start` in another.
3. Install the MuseScore plugin (see `plugin/README.md`), open a
   score and run **Plugins → Cadenza Sender**. The waterfall populates
   with the extracted notes.
4. In the Cadenza window pick your MIDI device (USB or Bluetooth) from
   the dropdown and click **Use device**.
5. Hit **Start** to zero the clock and begin validation. Correct hits
   turn notes green, misses turn them red.

## Run the unit tests

```bash
npm test
```

This uses Node's built-in test runner (`node --test`) against the
framework-free logic modules (`timeline`, `protocol`, `ws-client`). No
bundler or headless browser is required.

## Rendering notes

- Three.js is imported by a direct relative path
  (`../../node_modules/three/build/three.module.js`). We previously used a
  `<script type="importmap">` with the bare specifier `"three"`, but our
  CSP (`script-src 'self'`) blocks inline scripts — including import maps —
  so a direct relative import is the least-friction option that keeps the
  CSP strict and doesn't need a bundler.
- The scene uses an `OrthographicCamera` with the hit-line anchored at
  `y=0`. Notes descend from `+y` toward the line at
  `DEFAULT_PX_PER_MS = 0.25` px/ms by default.
- `WaterfallRenderer.reportPlayback` mutates the target mesh's colour in
  place so a successful hit immediately turns green, a miss turns red.

## Security / hardening

The renderer runs with:

```js
contextIsolation: true,
nodeIntegration: false,
sandbox: true,
preload: "preload.cjs",
```

A `Content-Security-Policy` meta tag locks script/style sources to `'self'`
and only allows WebSocket connections to `ws://127.0.0.1:*` and
`ws://localhost:*`. The preload only exposes a single constant
(`window.cadenza.defaultBackendUrl`).
