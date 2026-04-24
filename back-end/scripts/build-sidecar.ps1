param(
  [string]$OutputDir = "..\front-end\release\backend"
)

$ErrorActionPreference = "Stop"

Write-Host "[cadenza] Syncing backend dependencies with uv..."
uv sync --all-groups

Write-Host "[cadenza] Building backend sidecar with PyInstaller..."
uv run --with pyinstaller pyinstaller --onefile --name cadenza-server cadenza_server/__main__.py

$resolvedOutputDir = Resolve-Path -Path $OutputDir -ErrorAction SilentlyContinue
if (-not $resolvedOutputDir) {
  New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
  $resolvedOutputDir = Resolve-Path -Path $OutputDir
}

Write-Host "[cadenza] Copying binary to $resolvedOutputDir..."
Copy-Item -Path "dist\cadenza-server.exe" -Destination (Join-Path $resolvedOutputDir "cadenza-server.exe") -Force

Write-Host "[cadenza] Done. Backend sidecar at $resolvedOutputDir\cadenza-server.exe"
