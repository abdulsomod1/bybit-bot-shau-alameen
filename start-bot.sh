#!/bin/bash
# Bybit P2P Bot - Background Startup Script
# Run this with: bash start-bot.sh

cd /c/bot

echo "============================================================"
echo "  Bybit P2P Bot - Starting in background"
echo "============================================================"
echo ""

# Check Node.js
echo "[1/6] Checking Node.js..."
node --version || { echo "ERROR: Node.js not found!"; exit 1; }

# Check npm
echo "[2/6] Checking npm..."
npm --version || { echo "ERROR: npm not found!"; exit 1; }

# Check/install dependencies
echo "[3/6] Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies (first run)..."
    npm install
else
    echo "  node_modules found"
fi

# Build main process
echo "[4/6] Building main process TypeScript..."
npm run build:main
if [ $? -ne 0 ]; then
    echo "ERROR: build:main failed!"
    exit 1
fi

# Build preload
echo "[5/6] Building preload script..."
npm run build:preload
if [ $? -ne 0 ]; then
    echo "ERROR: build:preload failed!"
    exit 1
fi

# Start dev server in background
echo "[6/6] Starting development server..."
echo ""
echo "  Vite: http://localhost:5173"
echo "  Electron app will open automatically"
echo "  Logs: $APPDATA/bybit-p2p-bot/logs/"
echo ""
echo "============================================================"
echo "  Press Ctrl+C to stop"
echo "============================================================"
echo ""

# Run in background with nohup to prevent hanging
exec npm run dev
