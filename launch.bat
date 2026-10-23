@echo off
title Bybit P2P Bot Launcher
cd /d C:\bot
echo ==========================================
echo   Bybit P2P Bot - Build and Launch
echo ==========================================
echo.
echo [1/4] Building main process TypeScript...
call npx tsc -p tsconfig.main.json
if errorlevel 1 (
    echo BUILD FAILED: Main process TypeScript errors
    pause
    exit /b 1
)
echo   OK

echo [2/4] Building preload script...
call npx tsc -p src\preload\tsconfig.json
if errorlevel 1 (
    echo BUILD FAILED: Preload TypeScript errors
    pause
    exit /b 1
)
echo   OK

echo [3/4] Starting Vite dev server on http://localhost:5173 ...
start "Vite Dev Server" cmd /k "cd /d C:\bot && npx vite --port 5173 --host 0.0.0.0"
echo   Waiting for Vite to initialize...
timeout /t 8 /nobreak >nul

echo [4/4] Starting Electron app...
start "Bybit P2P Bot - Electron" cmd /k "cd /d C:\bot && npx electron ."

echo.
echo ==========================================
echo   Bot is launching!
echo ==========================================
echo.
echo   - Vite:     http://localhost:5173
echo   - Electron: Should have opened a window
echo.
echo   Check the windows that opened above.
echo   Close both windows to fully quit.
echo.
echo Press any key to close this window (bot keeps running)...
pause >nul
