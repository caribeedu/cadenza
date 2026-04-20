// Electron main process (ESM). Creates the BrowserWindow, hardens the
// renderer (contextIsolation + nodeIntegration: false) and exposes the
// location of the Three.js ES module so the renderer's import map can load
// it straight from node_modules without a bundler.

import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Bluetooth mitigation (TD-02). Electron >= 30 initialises Chromium
// Bluetooth on startup to match upstream Chromium behaviour. On Linux
// hosts where BlueZ is missing, blocked, or mid-handshake with a BLE
// MIDI device (and under WSL2 where BlueZ simply isn't there) this
// probe can stall the renderer for 25 s+ on the D-Bus activation
// timeout.
//
// Disabling WebBluetooth / BluetoothSerialPort asks Chromium to skip
// the features that pull in the Bluetooth adapter backend. It is not a
// total fix today (Chromium still initialises the adapter in some
// configurations regardless of the flags), but it shrinks the surface
// area and is what upstream recommends until Electron >= 42 lands a
// lazy-init fix. On hosts where Bluetooth is healthy this is a no-op.
//
// Must run *before* ``app.whenReady()`` resolves — Chromium reads the
// switch list during its own boot sequence.
app.commandLine.appendSwitch(
  "disable-features",
  "WebBluetooth,BluetoothSerialPort",
);

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0d17",
    title: "Cadenza",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  return win;
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Exported for potential programmatic launchers.
export { projectRoot };
