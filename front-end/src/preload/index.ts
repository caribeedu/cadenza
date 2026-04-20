// Sandboxed preload. The renderer runs with contextIsolation + sandbox,
// so the only way to pass information from main is through
// `contextBridge`. Keep the exposed surface minimal; the UI already
// runs its WebSocket connection directly.

import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("cadenza", {
  defaultBackendUrl: "ws://127.0.0.1:8765",
});
