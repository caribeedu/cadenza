#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:-../front-end/release/backend}"

echo "[cadenza] Syncing backend dependencies with uv..."
uv sync --all-groups

echo "[cadenza] Building backend sidecar with PyInstaller..."
uv run --with pyinstaller pyinstaller --onefile --name cadenza-server cadenza_server/__main__.py

mkdir -p "${OUTPUT_DIR}"
cp "dist/cadenza-server" "${OUTPUT_DIR}/cadenza-server"

echo "[cadenza] Done. Backend sidecar at ${OUTPUT_DIR}/cadenza-server"
