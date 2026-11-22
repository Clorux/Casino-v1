#!/usr/bin/env bash
# Velvet Vault Casino - Linux / macOS Offline Terminal Launcher
# Usage: ./launch-casino.sh          (full offline web casino on localhost:3000)
# Usage: ./launch-casino.sh --cli    (play directly in terminal)

set -e
echo ""
echo "  VELVET VAULT CASINO - 100% OFFLINE LAUNCHER"
echo "  ============================================"

if ! command -v node >/dev/null 2>&1; then
  echo "  [ERROR] Node.js not found. Install Node.js v18+ first."
  exit 1
fi

if [ "${1:-}" = "--cli" ]; then
  exec node cli/casino-cli.mjs
fi

if [ ! -d "node_modules" ]; then
  echo "  Installing local dependencies..."
  npm install
fi

echo "  Serving offline at http://localhost:3000 (Ctrl+C to stop)"
exec npx vite --port 3000 --host 0.0.0.0
