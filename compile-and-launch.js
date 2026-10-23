// compile-and-launch.js - Build TypeScript and launch the Electron app
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const root = 'C:\\bot';
const log = (msg) => { console.log(msg); fs.appendFileSync(path.join(root, 'launch_log.txt'), msg + '\n'); };

fs.writeFileSync(path.join(root, 'launch_log.txt'), '');
log('=== Build & Launch Script ===');

function run(cmd, label, timeout = 60000) {
  log(`\n[${label}] Running: ${cmd}`);
  try {
    const result = execSync(cmd, { cwd: root, encoding: 'utf8', timeout, windowsHide: true });
    log(`[${label}] OK\n${result || '(no output)'}`);
    return { ok: true, result };
  } catch (e) {
    const out = e.stdout || '';
    const err = e.stderr || '';
    const msg = `[${label}] FAILED\nSTDOUT: ${out}\nSTDERR: ${err}\n${e.message}`;
    log(msg);
    return { ok: false, error: msg, stdout: out, stderr: err };
  }
}

// Step 1: Build main process
const mainResult = run('npx tsc -p tsconfig.main.json', 'build:main');
if (!mainResult.ok) {
  log('\n!!! build:main failed. Check launch_log.txt for details.');
  process.exit(1);
}

// Step 2: Build preload
const preloadResult = run('npx tsc -p src/preload/tsconfig.json', 'build:preload');
if (!preloadResult.ok) {
  log('\n!!! build:preload failed. Check launch_log.txt for details.');
  process.exit(1);
}

// Step 3: Verify outputs
const mainJs = path.join(root, 'dist\\main\\main\\main.js');
const preloadJs = path.join(root, 'dist\\main\\preload.js');
log(`\nVerifying outputs:`);
log(`  main.js:   ${fs.existsSync(mainJs) ? 'EXISTS' : 'MISSING'} (${mainJs})`);
log(`  preload.js: ${fs.existsSync(preloadJs) ? 'EXISTS' : 'MISSING'} (${preloadJs})`);

if (!fs.existsSync(mainJs) || !fs.existsSync(preloadJs)) {
  log('\n!!! Build outputs missing. Cannot launch.');
  process.exit(1);
}

// Step 4: Start Vite dev server in background
log('\n[dev:vite] Starting Vite dev server...');
const vite = spawn('npx', ['vite', '--port', '5173', '--host', '0.0.0.0'], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
  windowsHide: true
});
vite.unref();
log('[dev:vite] Vite started (PID: ' + vite.pid + ')');

// Step 5: Wait for Vite to start
log('\n[wait] Waiting 10s for Vite to initialize...');
const waitUntil = Date.now() + 10000;
while (Date.now() < waitUntil) {
  // spin wait
  const start = Date.now();
  while (Date.now() - start < 500) { /* busy wait */ }
  log(`  ...still waiting (${Math.round((waitUntil - Date.now())/1000)}s left)`);
}

// Step 6: Start Electron
log('\n[electron] Starting Electron app...');
const electron = spawn('npx', ['electron', '.'], {
  cwd: root,
  detached: true,
  stdio: 'ignore',
  windowsHide: true
});
electron.unref();
log('[electron] Electron started (PID: ' + electron.pid + ')');

log('\n=== Bot is launching! ===');
log('Vite:     http://localhost:5173');
log('Electron: Check your desktop');
log('\nSee launch_log.txt for details.');
