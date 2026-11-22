#!/data/data/com.termux/files/usr/bin/bash
# Velvet Vault Casino - Android Termux 100% Offline Launcher
# First-time setup in Termux:
#   pkg update && pkg install nodejs-lts -y
#   chmod +x launch-termux.sh
#   ./launch-termux.sh          (launches offline web app + opens Android browser)
#   ./launch-termux.sh --cli    (plays directly inside Termux terminal)

set -e
echo ""
echo "  VELVET VAULT CASINO - TERMUX (ANDROID) OFFLINE"
echo "  ==============================================="

if ! command -v node >/dev/null 2>&1; then
  echo "  Installing Node.js in Termux..."
  pkg update -y && pkg install nodejs-lts -y
fi

if [ "${1:-}" = "--cli" ]; then
  exec node cli/casino-cli.mjs
fi

if [ ! -d "node_modules" ]; then
  echo "  Installing dependencies..."
  npm install
fi

echo "  Offline Casino running at http://127.0.0.1:3000"
if command -v termux-open-url >/dev/null 2>&1; then
  (sleep 2 && termux-open-url http://127.0.0.1:3000) &
fi
exec npx vite --port 3000 --host 0.0.0.0
