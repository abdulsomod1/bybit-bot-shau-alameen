@echo off
chcp 65001 >nul
cd /d C:\bot
title Bybit P2P Bot — Dev Launcher

echo ==========================================
echo   Bybit P2P Bot — Dev Launcher
echo ==========================================
echo.

echo [1/5] Building main process TypeScript...
call npx tsc -p tsconfig.main.json 2> build_err_main.txt
if errorlevel 1 (
    echo   FAILED - see build_err_main.txt
    type build_err_main.txt
    pause
    exit /b 1
)
echo   OK

echo.
echo [2/5] Building preload script...
call npx tsc -p src\preload\tsconfig.json 2> build_err_preload.txt
if errorlevel 1 (
    echo   FAILED - see build_err_preload.txt
    type build_err_preload.txt
    pause
    exit /b 1
)
echo   OK

echo.
echo [3/5] Checking build outputs...
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
echo   dist\main\main\main.js   OK
echo   dist\main\preload.js     OK

echo.
echo [4/5] Starting Vite dev server...
echo   (The Vite window will open. Keep it running!)
start "Vite Dev Server (keep open!)" cmd /k "cd /d C:\bot && npx vite --port 5173 --host 0.0.0.0"
echo   Waiting 15 seconds for Vite to start...
timeout /t 15 /nobreak >nul

echo.
echo [5/5] Verifying Vite is running...
curl -s -o nul -w "%%{http_code}" http://localhost:5173 > vite_status.txt
set /p VITE_STATUS=<vite_status.txt
if "%VITE_STATUS%"=="200" (
    echo   Vite is responding (HTTP %VITE_STATUS%)
) else (
    echo   WARNING: Vite returned HTTP %VITE_STATUS% - the app may not load correctly
)

echo.
echo [LAUNCH] Starting Electron...
echo   (The Electron window should open now)
echo.
start "Bybit P2P Bot" cmd /k "cd /d C:\bot && npx electron . --remote-debugging-port=9222"

echo.
echo ==========================================
echo   Bot is launching!
echo ==========================================
echo.
echo   Vite:     http://localhost:5173
echo   Electron: Should have opened a window
echo.
echo   Two windows are open:
echo   - [Vite Dev Server] - Keep this running!
echo   - [Bybit P2P Bot]   - The application window
echo.
echo   To debug: press F12 in the Electron window
echo   to open DevTools and check the Console.
echo.
echo Press any key to close this window...
echo (Both processes keep running in the background)
pause >nul
