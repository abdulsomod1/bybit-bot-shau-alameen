// dev-launcher.js — Build + robust Vite + Electron launch with full logging
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\bot';
const LOG = path.join(ROOT, 'dev_launch.log');
const VITE_OUT = path.join(ROOT, 'vite_out.log');
const SERVER_OUT = path.join(ROOT, 'server_out.log');
const ELECTRON_OUT = path.join(ROOT, 'electron_out.log');

// Clear log
fs.writeFileSync(LOG, '');
const log = (...a) => {
  const msg = a.map(x => String(x)).join(' ');
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  log('=== dev-launcher starting ===');
  log('Node:', process.version);

  // 1. Build main process
  log('\n[1/4] Building main process...');
  await new Promise((res, rej) => {
    const p = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', code => code === 0 ? res() : rej(new Error(`build:main failed (${code})`)));
  });
  log('build:main OK');

  // 2. Build preload
  log('\n[2/4] Building preload...');
  await new Promise((res, rej) => {
    const p = spawn('npx', ['tsc', '-p', 'src/preload/tsconfig.json'], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', code => code === 0 ? res() : rej(new Error(`build:preload failed (${code})`)));
  });
  log('build:preload OK');

  // 3. Build server
  log('\n[3/4] Building Express server...');
  await new Promise((res, rej) => {
    const p = spawn('npx', ['tsc', '-p', 'tsconfig.server.json'], { cwd: ROOT, stdio: 'inherit' });
    p.on('close', code => code === 0 ? res() : rej(new Error(`build:server failed (${code})`)));
  });
  log('build:server OK');

  // 4. Verify outputs
  const mainJs = path.join(ROOT, 'dist/main/main/main.js');
  const preloadJs = path.join(ROOT, 'dist/main/preload.js');
  const serverJs = path.join(ROOT, 'dist/server/index.js');
  if (!fs.existsSync(mainJs)) { log('ERROR: main.js missing'); process.exit(1); }
  if (!fs.existsSync(preloadJs)) { log('ERROR: preload.js missing'); process.exit(1); }
  if (!fs.existsSync(serverJs)) { log('ERROR: server/index.js missing'); process.exit(1); }
  log('Build outputs verified OK');

  // 5. Kill any stale processes
  log('\nClearing old processes on ports 3000/5173/9222...');
  ['taskkill /F /IM node.exe 2>nul'].forEach(cmd => {
    try { require('child_process').execSync(cmd, { cwd: ROOT, stdio: 'ignore', windowsHide: true }); } catch {}
  });
  ['taskkill /F /IM electron.exe 2>nul'].forEach(cmd => {
    try { require('child_process').execSync(cmd, { cwd: ROOT, stdio: 'ignore', windowsHide: true }); } catch {}
  });

  // 6. Start Express API server (detached, output to file)
  log('\n[5] Starting Express API server...');
  const serverFd = fs.openSync(SERVER_OUT, 'w');
  const server = spawn('node', ['dist/server/index.js'], {
    cwd: ROOT, detached: true, stdio: ['ignore', serverFd, serverFd], windowsHide: false
  });
  server.unref();
  fs.closeSync(serverFd);
  log(`Express server spawned (pid=${server.pid}), logs → server_out.log`);

  // 7. Poll for Express readiness (max 15s)
  log('Waiting for Express server to respond...');
  const http = require('http');
  let serverReady = false;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await sleep(1000);
    try {
      const ok = await new Promise((res) => {
        const req = http.get('http://localhost:3000/health', r => { res(r.statusCode === 200); });
        req.on('error', () => res(false));
        req.setTimeout(3000, () => { req.destroy(); res(false); });
      });
      if (ok) { serverReady = true; break; }
    } catch {}
    process.stdout.write('.');
  }
  console.log();
  if (!serverReady) { log('ERROR: Express server did not respond in 15s. Check server_out.log'); process.exit(1); }
  log('Express server is ready on http://localhost:3000');

  // 8. Start Vite (detached, output to file)
  log('\n[6] Starting Vite dev server...');
  const viteFd = fs.openSync(VITE_OUT, 'w');
  const vite = spawn('npx', ['vite', '--port', '5173', '--host', '0.0.0.0'], {
    cwd: ROOT, detached: true, stdio: ['ignore', viteFd, viteFd], windowsHide: false
  });
  vite.unref();
  fs.closeSync(viteFd);
  log(`Vite spawned (pid=${vite.pid}), logs → vite_out.log`);

  // 9. Poll for Vite readiness (max 30s)
  log('Waiting for Vite to respond...');
  let viteReady = false;
  const viteDeadline = Date.now() + 30000;
  while (Date.now() < viteDeadline) {
    await sleep(1000);
    try {
      const ok = await new Promise((res) => {
        const req = http.get('http://localhost:5173', r => { res(r.statusCode === 200); });
        req.on('error', () => res(false));
        req.setTimeout(3000, () => { req.destroy(); res(false); });
      });
      if (ok) { viteReady = true; break; }
    } catch {}
    process.stdout.write('.');
  }
  console.log();
  if (!viteReady) { log('ERROR: Vite did not respond in 30s. Check vite_out.log'); process.exit(1); }
  log('Vite is ready on http://localhost:5173');

  // 10. Start Electron
  log('\n[7] Starting Electron...');
  const elecFd = fs.openSync(ELECTRON_OUT, 'w');
  const elec = spawn('npx', ['electron', '.', '--remote-debugging-port=9222'], {
    cwd: ROOT, detached: true, stdio: ['ignore', elecFd, elecFd], windowsHide: false
  });
  elec.unref();
  fs.closeSync(elecFd);
  log(`Electron spawned (pid=${elec.pid}), logs → electron_out.log`);

  log('\n=== All done! App should be visible ===');
  log('Express: http://localhost:3000 (API server)');
  log('Vite:    http://localhost:5173 (keep this terminal running)');
  log('Electron window should be showing the app.');
  log('Press F12 in Electron to open DevTools.');
}

main().catch(e => { log('FATAL:', e.message); process.exit(1); });