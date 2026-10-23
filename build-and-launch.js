// build-and-launch.js
// Runs: build main → build preload → verify → start vite + electron
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = 'C:\\bot';
const logFile = path.join(root, 'bal_log.txt');
const out = fs.openSync(logFile, 'w');

function log(msg) {
  const line = msg + '\n';
  fs.writeSync(out, line);
  process.stdout.write(msg + '\n');
}

function run(cmd, label, timeout) {
  log(`\n[${label}] EXEC: ${cmd}`);
  try {
    const r = execSync(cmd, { cwd: root, timeout: timeout || 90000, windowsHide: false });
    const result = r ? r.toString() : '(no output)';
    log(`[${label}] OK\n${result.trim()}`);
    return { ok: true, result };
  } catch(e) {
    const so = e.stdout ? e.stdout.toString() : '';
    const se = e.stderr ? e.stderr.toString() : '';
    log(`[${label}] EXIT ${e.status}\nSTDOUT:\n${so}\nSTDERR:\n${se}`);
    return { ok: false, stdout: so, stderr: se, status: e.status };
  }
}

log('=== Build & Launch ===');
log('Root: ' + root);

// 1. build main
const r1 = run('npx tsc -p tsconfig.main.json', 'build:main');
if (!r1.ok) { log('!!! build:main FAILED'); fs.closeSync(out); process.exit(1); }

// 2. build preload
const r2 = run('npx tsc -p src\\preload\\tsconfig.json', 'build:preload');
if (!r2.ok) { log('!!! build:preload FAILED'); fs.closeSync(out); process.exit(1); }

// 3. verify
const mainExists = fs.existsSync(path.join(root, 'dist\\main\\main\\main.js'));
const preloadExists = fs.existsSync(path.join(root, 'dist\\main\\preload.js'));
log(`\nCheck: main.js=${mainExists} preload.js=${preloadExists}`);
if (!mainExists) { log('!!! main.js missing'); fs.closeSync(out); process.exit(1); }
if (!preloadExists) { log('!!! preload.js missing'); fs.closeSync(out); process.exit(1); }

// 4. start vite (detached) — use cmd.exe /c so .cmd files work
log('\n[Step 4] Starting Vite dev server...');
spawn('cmd.exe', ['/c', 'npx.cmd', 'vite', '--port', '5173', '--host', '0.0.0.0'], {
  cwd: root, detached: true, stdio: 'ignore'
}).unref();
log('Vite started. Waiting 12s...');
const t = Date.now() + 12000;
while (Date.now() < t) {
  const ms = Math.ceil((t - Date.now()) / 1000);
  log(`  waiting ... ${ms}s`);
  const s = Date.now();
  while (Date.now() - s < 1000) {}
}

// 5. start electron (detached) — use cmd.exe /c so .cmd files work
log('\n[Step 5] Starting Electron...');
spawn('cmd.exe', ['/c', 'npx.cmd', 'electron', '.'], {
  cwd: root, detached: true, stdio: 'ignore'
}).unref();
log('Electron started (PID written above if visible).');

log('\n=== DONE - Bot should be running ===');
log('Vite: http://localhost:5173');
log('Check desktop for Electron window');
fs.closeSync(out);