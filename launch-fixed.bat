@echo off
title Bybit P2P Bot Launcher
cd /d C:\bot
echo ==========================================
echo   Bybit P2P Bot - Build and Launch
echo ==========================================
echo.
echo [1/4] Building main process TypeScript...
call npx tsc -p tsconfig.main.json 2> build_err_main.txt
if errorlevel 1 (
    echo   FAILED - see build_err_main.txt
    type build_err_main.txt
    pause
    exit /b 1
)
echo   OK

echo.
echo [2/4] Building preload script...
call npx tsc -p src\preload\tsconfig.json 2> build_err_preload.txt
if errorlevel 1 (
    echo   FAILED - see build_err_preload.txt
    type build_err_preload.txt
    pause
    exit /b 1
)
echo   OK

echo.
echo [3/4] Verifying build outputs...
if not exist "dist\main\main\main.js" (
    echo   ERROR: dist\main\main\main.js NOT FOUND
    pause
    exit /b 1
)
if not exist "dist\main\preload.js" (
    echo   ERROR: dist\main\preload.js NOT FOUND
    pause
    exit /b 1
)
echo   main.js    OK
echo   preload.js OK

echo.
echo [4/4] Starting Vite dev server on http://localhost:5173 ...
start "Vite Dev Server" cmd /k "cd /d C:\bot && npx vite --port 5173 --host 0.0.0.0"
echo   Waiting for Vite to initialize (15 seconds)...
timeout /t 15 /nobreak >nul

echo.
echo [LAUNCH] Starting Electron app...
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
