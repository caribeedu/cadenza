import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Bluetooth mitigation (see TECH-DEBTS.md → TD-02). Electron >= 30
// initialises Chromium Bluetooth on startup; on Linux hosts without
// healthy BlueZ (notably WSL2) the probe stalls for tens of seconds.
// Disabling the features shrinks the surface area until Electron ≥ 42
// lands the lazy-init fix. Must run before `app.whenReady()`.
app.commandLine.appendSwitch(
  "disable-features",
  "WebBluetooth,BluetoothSerialPort",
);

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL;
const RENDERER_INDEX = path.join(__dirname, "../renderer/index.html");
// Preload is forced to CommonJS (electron.vite.config.ts) so it works
// with the sandboxed renderer; ``index.js`` is the emitted filename.
const PRELOAD_PATH = path.join(__dirname, "../preload/index.js");

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    backgroundColor: "#0b0d17",
    height: 800,
    show: false,
    title: "Cadenza",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: PRELOAD_PATH,
      sandbox: true,
    },
    width: 1280,
  });

  win.setMenuBarVisibility(false);
  win.once("ready-to-show", () => win.show());

  if (DEV_SERVER_URL) {
    void win.loadURL(DEV_SERVER_URL);
  } else {
    void win.loadFile(RENDERER_INDEX);
  }

  return win;
}

void app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
