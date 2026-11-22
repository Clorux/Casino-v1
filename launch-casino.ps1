# Velvet Vault Casino - Windows PowerShell Offline Launcher
# Run: .\launch-casino.ps1            (launches offline Web UI on http://localhost:3000)
# Run: .\launch-casino.ps1 -CliOnly   (plays directly inside PowerShell terminal)

param(
    [switch]$CliOnly,
    [int]$Port = 3000
)

$ErrorActionPreference = "Stop"
Write-Host ""
Write-Host "  VELVET VAULT CASINO - 100% OFFLINE LAUNCHER" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor DarkYellow

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "  [ERROR] Node.js is required. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

if ($CliOnly) {
    Write-Host "  Starting interactive PowerShell Terminal Casino..." -ForegroundColor Green
    node cli/casino-cli.mjs
    exit $LASTEXITCODE
}

if (-not (Test-Path "node_modules")) {
    Write-Host "  Installing local dependencies (first run only)..." -ForegroundColor Cyan
    npm install
}

Write-Host "  Starting offline casino server on http://localhost:$Port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop. Opening browser..." -ForegroundColor Gray
Start-Process "http://localhost:$Port"
npx vite --port $Port --host 0.0.0.0
