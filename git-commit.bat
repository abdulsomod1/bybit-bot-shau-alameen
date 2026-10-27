@echo off
cd /d c:\bot
git add -A
git commit -m "Improved RENDER_SERVICE_ENCRYPTION_KEY validation with better error messages"
git push
pause