#!/usr/bin/env python3
"""
Bybit P2P Bot - Python Launcher (Updated)
Cleans up processes, builds all TypeScript, starts API server + Vite + Electron.
"""
import subprocess
import time
import os
import socket

os.chdir(r"C:\bot")

def run_cmd(args, timeout=120, show_stderr=True):
    """Run a command. Returns returncode."""
    cmd_str = ' '.join(args) if isinstance(args, list) else args
    print(f"\n>>> {cmd_str}")
    r = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if r.stdout:
        for line in r.stdout.strip().split('\n'):
            if line.strip():
                print(f"  {line}")
    if r.returncode != 0 and show_stderr and r.stderr:
        for line in r.stderr.strip().split('\n'):
            if line.strip():
                print(f"  [ERR] {line}")
    if r.returncode == 0:
        print(f"  OK")
    return r.returncode

# Kill existing processes
print("=" * 50)
print("  Bybit P2P Bot - Starting")
print("=" * 50)
print()
print("[1] Killing stale processes...")
for proc in ["electron.exe", "node.exe"]:
    subprocess.run(["taskkill", "/F", "/IM", proc], capture_output=True)
time.sleep(1)
print("  Done.")

# Check Node.js
print()
print("[2] Node.js version:")
r = subprocess.run(["node", "--version"], capture_output=True, text=True)
print(f"  {r.stdout.strip()}")

# Install deps if needed
print()
print("[3] Checking node_modules...")
if not os.path.exists(r"C:\bot\node_modules"):
    print("  Installing dependencies (first run)...")
    rc = run_cmd(["npm", "install"], timeout=300)
else:
    print("  node_modules found - skipping install.")

# Build main
print()
print("[4] Building main process TypeScript...")
rc = run_cmd(["npx", "tsc", "-p", "tsconfig.main.json"], timeout=120)
if rc != 0:
    print("  WARNING: build:main had issues. Trying to continue...")

# Build preload
print()
print("[5] Building preload script...")
rc = run_cmd(["npx", "tsc", "-p", "src/preload/tsconfig.json"], timeout=60)
if rc != 0:
    print("  WARNING: build:preload had issues. Trying to continue...")

# Build renderer
print()
print("[6] Building renderer (Vite)...")
rc = run_cmd(["npm", "run", "build:renderer"], timeout=120)
if rc != 0:
    print("  WARNING: build:renderer had issues. Trying to continue...")

# Build server
print()
print("[7] Building Express server...")
rc = run_cmd(["npm", "run", "build:server"], timeout=120)
if rc != 0:
    print("  WARNING: build:server had issues. Trying to continue...")

# Check compiled files
print()
print("[8] Checking build output...")
for f in ["dist/main/main/main.js", "dist/main/preload.js", "dist/renderer/index.html", "dist/server/index.js"]:
    exists = os.path.exists(f"C:\\bot\\{f}")
    print(f"  {f}: {'EXISTS' if exists else 'MISSING'}")

# Start Express API server (port 3000)
print()
print("[9] Starting Express API server...")
subprocess.Popen(
    ["cmd", "/c", "cd /d C:\\bot && node dist/server/index.js"],
    creationflags=subprocess.CREATE_NEW_CONSOLE
)
print("  Express server starting on port 3000...")
time.sleep(3)

# Check if Express is up
try:
    s = socket.socket()
    s.settimeout(2)
    r = s.connect_ex(("127.0.0.1", 3000))
    s.close()
    express_status = "OPEN" if r == 0 else f"closed (code {r})"
except:
    express_status = "error checking"

print(f"  Express port 3000: {express_status}")

# Start Vite dev server
print()
print("[10] Starting Vite dev server...")
subprocess.Popen(
    ["cmd", "/c", "cd /d C:\\bot && npx vite --port 5173 --host 0.0.0.0"],
    creationflags=subprocess.CREATE_NEW_CONSOLE
)
print("  Vite starting in new window...")
time.sleep(6)

# Check if Vite is up
try:
    s = socket.socket()
    s.settimeout(2)
    r = s.connect_ex(("127.0.0.1", 5173))
    s.close()
    vite_status = "OPEN" if r == 0 else f"closed (code {r})"
except:
    vite_status = "error checking"

print(f"  Vite port 5173: {vite_status}")

# Start Electron
print()
print("[11] Starting Electron...")
subprocess.Popen(
    ["cmd", "/c", "cd /d C:\\bot && npx electron ."],
    creationflags=subprocess.CREATE_NEW_CONSOLE
)
time.sleep(3)

# Check Electron
r = subprocess.run(["tasklist"], capture_output=True, text=True)
found = [l for l in r.stdout.splitlines() if "electron" in l.lower()]
if found:
    print("  Electron processes:")
    for line in found[:3]:
        print(f"    {line.strip()}")
else:
    print("  Electron: not yet visible (may take a moment)")

print()
print("=" * 50)
print("  Bot should be running!")
print("  Express:  http://localhost:3000 (API server)")
print("  Vite:     http://localhost:5173 (dev server)")
print("  Electron: Should have opened a window")
print("=" * 50)
print()
print("NOTE: The .env file has placeholder values.")
print("Edit c:\\bot\\.env with real Supabase credentials")
print("for full functionality.")
print()
print("Press Enter to exit this window (bot keeps running)...")
try:
    input()
except (EOFError, KeyboardInterrupt):
    pass

