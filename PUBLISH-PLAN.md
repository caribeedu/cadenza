# Publish plan: desktop bundle without user-installed Node or Python

This document outlines options for shipping **Cadenza** as a single distributable: **Electron front-end**, **Python (FastAPI) back-end**, and **MuseScore plugin**, without asking end users to install Node.js or Python.

---

## Goals

| Constraint | Approach |
|------------|----------|
| Users do not install **Node.js** | Ship **prebuilt Electron** installers (built in CI). The app bundles Chromium and an embedded Node runtime; users never run `npm` or `node` on the command line. |
| Users do not install **Python** | Ship the API as a **frozen binary**, **embedded Python layout**, or equivalent; **uv** / `pip` are **build-time** tools only. |
| **MuseScore plugin** is part of the product | Bundle plugin assets in the installer and install them into MuseScore’s plugin directory (or guide the user on first launch). |

---

## 1. Electron (front-end)

**What users get:** `.exe` (Windows), `.dmg` / `.pkg` (macOS), or `.AppImage` / `.deb` (Linux), produced by tooling such as **electron-builder**, **Electron Forge**, or **electron-vite**’s packaging integration.

**What you do in CI:**

- `npm ci` → `npm run build` (or your `electron-vite build` pipeline).
- Package the `out/` / `dist/` tree plus native dependencies into the installer.

**Users never:** clone the repo, run `npm install`, or install Node from nodejs.org.

---

## 2. Python back-end (FastAPI + uv today)

**uv** and virtualenvs are for **developers**. For releases:

| Option | Pros | Cons |
|--------|------|------|
| **PyInstaller** (one-file or one-folder) | Common, docs abundant; easy to spawn from Electron as a **sidecar** `.exe` / binary. | Cold-start cost for one-file; AV false positives if unsigned. |
| **Nuitka** | Often smaller/faster binaries; good for distribution. | Longer compile; steeper learning curve. |
| **Embedded Python + copied `site-packages`** | Full control; no “freezer” magic. | You maintain layout, updates, and launcher glue. |
| **cx_Freeze / Briefcase / PyOxidizer** | Alternatives worth evaluating per platform. | Ecosystem overlap with PyInstaller/Nuitka. |

**Typical layout:**

1. In **CI**: `uv sync` (or lockfile install) into a clean environment.
2. Run **PyInstaller** / **Nuitka** against your FastAPI entrypoint (e.g. `uvicorn` app module or a small `main` that mounts the app).
3. Ship the resulting binary (and DLLs on Windows) **next to** the Electron app, e.g. `resources/backend/cadenza-api.exe`.

**Electron main process:** `child_process.spawn` the sidecar on startup, bind FastAPI to `127.0.0.1` on a **fixed port** or a port written to a small config file beside the app. Tear down the process on quit.

---

## 3. MuseScore plugin

Plugins are **files** (QML/JS/resources) loaded from MuseScore’s **plugin directory** (path differs by OS and MuseScore major version).

**Bundle contents:**

- Keep a `plugin/` (or `muse-plugin/`) directory in the repo that mirrors what MuseScore expects.

**Installer / first-run:**

- **Copy** plugin files into the OS-specific MuseScore 4 plugin folder, **or**
- Open a **setup wizard** that explains the path and offers **“Open plugin folder”** / **“Reveal in Finder”** and manual copy.

The plugin usually **lives outside** Electron’s `app.asar`; it is installed **for MuseScore**, not inside the Electron binary.

---

## 4. Single installer (mental model)

One **setup wizard** (e.g. **Inno Setup**, **NSIS**, **WiX** on Windows; **pkgbuild** / **create-dmg** on macOS) can:

1. Install the Electron app under `Program Files` / `/Applications`.
2. Install the Python sidecar under the same prefix or `%LOCALAPPDATA%` / `~/Library/Application Support/…`.
3. Copy MuseScore plugin files to the documented plugin path (or run a post-install script).
4. Optional: desktop shortcut, uninstaller, registry keys (Windows).

---

## 5. Operational concerns

| Topic | Notes |
|-------|--------|
| **CPU architecture** | Ship **x64** (and **arm64** on Apple Silicon macOS if you build for it). Electron binary and Python sidecar must match. |
| **Code signing** | Sign the Electron app **and** the Python binary on Windows/macOS to reduce SmartScreen / Gatekeeper friction. |
| **Networking** | Prefer `127.0.0.1` only; avoid exposing the API on all interfaces unless required. |
| **Updates** | Plan separately: **electron-updater** (or similar) for the shell; replace sidecar binaries or run a small updater for the API. |
| **Antivirus** | Unsigned PyInstaller binaries are often flagged; signing and reputation over time help. |

---

## 6. Suggested next steps (repository)

1. Add a **release** CI job that builds Electron + frozen backend + plugin zip layout (artifact, not necessarily public store yet).
2. Document **exact** FastAPI entry command and **port** in one place (env vars or config) so main process and renderer agree.
3. List **MuseScore 4** plugin paths per OS in this doc or `README` when you automate installation.

---

## 7. What this repo contains today (reference)

- **Front-end:** `front-end/` — Electron + Vite (`package.json`).
- **Back-end:** `back-end/` — Python project (`pyproject.toml`); use this as the source for freezing in CI.
- **Plugin:** `plugin/` — MuseScore 4 plugin source code; the installer should copy this to the correct MuseScore plugins folder basing in the user OS.

This file is a **planning** artifact; implementation details (exact PyInstaller spec, Inno script) belong next to those scripts when you add them.
