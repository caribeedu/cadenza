import { app, BrowserWindow } from "electron";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
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
const BACKEND_HOST = "127.0.0.1";
const BACKEND_PORT = 8765;
// Preload is forced to CommonJS (electron.vite.config.ts) so it works
// with the sandboxed renderer; ``index.js`` is the emitted filename.
const PRELOAD_PATH = path.join(__dirname, "../preload/index.js");
let backendProcess: ChildProcessWithoutNullStreams | null = null;

function resolveBundledPluginSource(): null | string {
  const candidate = path.join(process.resourcesPath, "plugin", "Cadenza.qml");
  return fs.existsSync(candidate) ? candidate : null;
}

function resolveMuseScorePluginDestination(): null | string {
  if (process.platform === "win32" || process.platform === "darwin") {
    return path.join(app.getPath("documents"), "MuseScore4", "Plugins", "Cadenza.qml");
  }
  if (process.platform === "linux") {
    return path.join(
      app.getPath("home"),
      ".local",
      "share",
      "MuseScore",
      "MuseScore4",
      "Plugins",
      "Cadenza.qml",
    );
  }
  return null;
}

function installBundledPluginIfAvailable(): void {
  if (!app.isPackaged) return;
  const source = resolveBundledPluginSource();
  const destination = resolveMuseScorePluginDestination();
  if (!source || !destination) return;

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  console.log(`[cadenza-plugin] installed ${destination}`);
}

function resolveBundledBackendBinary(): null | string {
  const executableName =
    process.platform === "win32" ? "cadenza-server.exe" : "cadenza-server";
  const candidate = path.join(process.resourcesPath, "backend", executableName);
  return fs.existsSync(candidate) ? candidate : null;
}

function startBundledBackendIfAvailable(): void {
  if (!app.isPackaged) return;
  const executable = resolveBundledBackendBinary();
  if (!executable) return;

  backendProcess = spawn(
    executable,
    ["--host", BACKEND_HOST, "--port", String(BACKEND_PORT)],
    {
      stdio: "pipe",
      windowsHide: true,
    },
  );

  backendProcess.stdout.on("data", (chunk) => {
    console.log(`[cadenza-backend] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.stderr.on("data", (chunk) => {
    console.error(`[cadenza-backend] ${chunk.toString().trimEnd()}`);
  });
  backendProcess.on("exit", (code, signal) => {
    console.warn(`[cadenza-backend] exited code=${code} signal=${signal ?? "none"}`);
    backendProcess = null;
  });
}

function stopBundledBackend(): void {
  if (!backendProcess || backendProcess.killed) return;
  backendProcess.kill();
}

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
  installBundledPluginIfAvailable();
  startBundledBackendIfAvailable();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBundledBackend();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  stopBundledBackend();
});
