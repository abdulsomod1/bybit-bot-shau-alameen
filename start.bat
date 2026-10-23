@echo off
chcp 65001 >nul
title Bybit P2P Bot
cd /d C:\bot
echo Compiling main process...
call npx tsc -p tsconfig.main.json
echo Starting Vite dev server...
start cmd /k "npx vite --port 5173 --host 0.0.0.0"
timeout /t 3 /nobreak >nul
echo Starting Electron...
call npx electron .

