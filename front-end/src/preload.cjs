// Sandboxed preload (CommonJS). Only exposes the minimum: Cadenza runs its
// WebSocket directly from the renderer so the preload surface stays tiny.

const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("cadenza", {
  defaultBackendUrl: "ws://127.0.0.1:8765",
});
