@echo off
title Bot Server Restart
cd /d C:\bot
echo Killing old server...
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 >nul
echo Starting server with fixed code...
node dist/server/index.js

