@echo off
chcp 65001 >nul
title Push Bot to GitHub
cd /d C:\bot

echo.
echo ==========================================
echo   PUSHING TO GITHUB
echo ==========================================
echo.

REM 1) Set remote
echo [1/5] Configuring GitHub remote...
git remote add origin https://github.com/abdulsomod1/bybit-bot-shau-alameen.git 2>nul
git remote set-url origin https://github.com/abdulsomod1/bybit-bot-shau-alameen.git
echo      Remote: origin = https://github.com/abdulsomod1/bybit-bot-shau-alameen.git
echo.

REM 2) Check status
echo [2/5] Checking git status...
git status --short
echo.

REM 3) Add all files
echo [3/5] Adding all files (git add -A)...
git add -A
if errorlevel 1 (
    echo      FAILED - could not add files
    pause
    exit /b 1
)
echo      Files staged.
echo.

REM 4) Commit
echo [4/5] Committing changes...
git commit -m "Fix duplicate key violation and bootstrap FK errors - saveCredentials checks row exists then updates or inserts"
if errorlevel 1 (
    echo      Nothing to commit - already up to date!
) else (
    echo      Commit created successfully!
)
echo.

REM 5) Push
echo [5/5] Pushing to GitHub...
echo.
echo      IMPORTANT: If Git asks for username/password,
echo      use your GitHub username and a PERSONAL ACCESS TOKEN (not your password).
echo      Get a token at: https://github.com/settings/tokens
echo.
git push -u origin master --force
if errorlevel 1 (
    echo.
    echo      PUSH FAILED!
    echo      Check your internet connection and GitHub credentials.
    echo      Get a Personal Access Token: https://github.com/settings/tokens
) else (
    echo.
    echo ==========================================
    echo   SUCCESS! PUSHED TO GITHUB!
    echo ==========================================
    echo.
    echo   Next step: Go to Render and trigger a new deploy.
    echo.
)
echo.
pause

