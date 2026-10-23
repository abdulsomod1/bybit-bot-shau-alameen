@echo off
title Bybit P2P Bot
cd /d C:\bot
color 0A

echo.
echo  ==============================================================
echo   Bybit P2P Bot - Starting
echo  ==============================================================
echo.

:: Kill stale processes
echo [1] Cleaning up...
taskkill /F /IM electron.exe >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

:: Check Node.js
echo [2] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo    ERROR: Node.js not found!
    echo    Install from https://nodejs.org
    pause
    exit /b 1
)
for /f "delims=" %%v in ('node --version') do echo    Node: %%v

:: Check npm
for /f "delims=" %%v in ('npm --version') do echo    npm:  %%v

:: Check node_modules
echo [3] Checking node_modules...
if not exist "node_modules" (
    echo    Installing dependencies (first run)...
    call npm install
    if errorlevel 1 (
        echo    ERROR: npm install failed!
        pause
        exit /b 1
    )
) else (
    echo    node_modules found
)

:: Build main TypeScript
echo [4] Building main process...
call npm run build:main
if errorlevel 1 (
    echo    WARNING: build:main had issues, continuing anyway...
)

:: Build preload
echo [5] Building preload script...
call npm run build:preload
if errorlevel 1 (
    echo    WARNING: build:preload had issues, continuing anyway...
)

:: Build renderer
echo [6] Building renderer...
call npm run build:renderer
if errorlevel 1 (
    echo    WARNING: build:renderer had issues, continuing anyway...
)

:: Check output
echo [7] Verifying build output...
if exist "dist\main\main.js" (echo    dist\main\main.js       EXISTS) else (echo    dist\main\main.js       MISSING!)
if exist "dist\main\preload.js" (echo    dist\main\preload.js    EXISTS) else (echo    dist\main\preload.js    MISSING!)
if exist "dist\renderer\index.html" (echo    dist\renderer\index.html EXISTS) else (echo    dist\renderer\index.html MISSING!)

echo.
echo  ==============================================================
echo   Starting application...
echo  ==============================================================
echo.
echo    Vite:      http://localhost:5173
echo    Electron:  Will open automatically
echo.
echo    Stop:      Press Ctrl+C in this window
echo.
echo  ==============================================================
echo.

:: Start dev server (this window will run the dev server)
npm run dev

