@echo off
title Velvet Vault Casino - Offline Launcher
echo.
echo   VELVET VAULT CASINO - 100%% OFFLINE LAUNCHER (CMD / DOS)
echo   =======================================================
echo   [1] Launch Full 60fps Offline Web Casino (http://localhost:3000)
echo   [2] Play Directly Inside Terminal (Zero-Browser CLI Mode)
echo.
set /p choice="Choose mode (1 or 2): "

if "%choice%"=="2" (
    node cli\casino-cli.mjs
    goto :eof
)

if not exist node_modules (
    echo Installing dependencies...
    call npm install
)

start "" http://localhost:3000
npx vite --port 3000 --host 0.0.0.0
