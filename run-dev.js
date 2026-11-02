// Build and launch the API server, Vite, and Electron for development.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(ROOT, '.env') });

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
const LOG = path.join(ROOT, 'dev_launch.log');
const VITE_OUT = path.join(ROOT, 'vite_out.log');
const SERVER_OUT = path.join(ROOT, 'server_out.log');
const ELECTRON_OUT = path.join(ROOT, 'electron_out.log');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const ELECTRON = path.join(ROOT, 'node_modules', 'electron', 'cli.js');

// Clear log
fs.writeFileSync(LOG, '');
const log = (...a) => {
  const msg = a.map(x => String(x)).join(' ');
  const line = `[${new Date().toISOString()}] ${msg}`;
  fs.appendFileSync(LOG, line + '\n');
  console.log(line);
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function build(label, config) {
  log(`\nBuilding ${label}...`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSC, '-p', config], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${code})`));
    });
  });
}

function isHealthy(url) {
  return new Promise(resolve => {
    const req = http.get(url, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    req.once('error', () => resolve(false));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  log('=== dev-launcher starting ===');
  log('Node:', process.version);

  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new Error(`Invalid PORT value: ${process.env.PORT}`);
  }

  await build('main process', 'tsconfig.main.json');
  await build('preload', 'src/preload/tsconfig.json');
  await build('API server', 'tsconfig.server.json');

  // 4. Verify outputs
  const mainJs = path.join(ROOT, 'dist/main/main/main.js');
  const preloadJs = path.join(ROOT, 'dist/main/preload.js');
  const serverJs = path.join(ROOT, 'dist/server/index.js');
  if (!fs.existsSync(mainJs)) { log('ERROR: main.js missing'); process.exit(1); }
  if (!fs.existsSync(preloadJs)) { log('ERROR: preload.js missing'); process.exit(1); }
  if (!fs.existsSync(serverJs)) { log('ERROR: server/index.js missing'); process.exit(1); }
  log('Build outputs verified OK');

  const healthUrl = `http://127.0.0.1:${PORT}/health`;
  let serverReady = await isHealthy(healthUrl);
  if (serverReady) {
    log(`API server is already responding at ${healthUrl}; reusing it.`);
  } else {
    log('\nStarting Express API server...');
    const serverFd = fs.openSync(SERVER_OUT, 'w');
    let server;
    try {
      server = spawn(process.execPath, [serverJs], {
        cwd: ROOT,
        detached: true,
        stdio: ['ignore', serverFd, serverFd],
      });
    } finally {
      fs.closeSync(serverFd);
    }
    server.once('error', error => log('Express server spawn error:', error.message));
    server.unref();
    log(`Express server spawned (pid=${server.pid}), logs → server_out.log`);
  }

  // Poll for Express readiness (max 15s).
  log('Waiting for Express server to respond...');
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    await sleep(1000);
    if (await isHealthy(healthUrl)) { serverReady = true; break; }
    process.stdout.write('.');
  }
  console.log();
  if (!serverReady) { log(`ERROR: Express server did not respond in 15s. Check ${SERVER_OUT}`); process.exit(1); }
  log(`Express server is ready at ${healthUrl}`);

  // 8. Start Vite (detached, output to file)
  log('\n[6] Starting Vite dev server...');
  const viteFd = fs.openSync(VITE_OUT, 'w');
  const vite = spawn(process.execPath, [VITE, '--port', '5173', '--host', '0.0.0.0'], {
    cwd: ROOT, detached: true, stdio: ['ignore', viteFd, viteFd]
  });
  vite.once('error', error => log('Vite spawn error:', error.message));
  vite.unref();
  fs.closeSync(viteFd);
  log(`Vite spawned (pid=${vite.pid}), logs → vite_out.log`);

  // 9. Poll for Vite readiness (max 30s)
  log('Waiting for Vite to respond...');
  let viteReady = false;
  const viteDeadline = Date.now() + 30000;
  while (Date.now() < viteDeadline) {
    await sleep(1000);
    if (await isHealthy('http://127.0.0.1:5173')) { viteReady = true; break; }
    process.stdout.write('.');
  }
  console.log();
  if (!viteReady) { log('ERROR: Vite did not respond in 30s. Check vite_out.log'); process.exit(1); }
  log('Vite is ready on http://localhost:5173');

  // 10. Start Electron
  log('\n[7] Starting Electron...');
  const elecFd = fs.openSync(ELECTRON_OUT, 'w');
  const elec = spawn(process.execPath, [ELECTRON, '.', '--remote-debugging-port=9222'], {
    cwd: ROOT, detached: true, stdio: ['ignore', elecFd, elecFd]
  });
  elec.once('error', error => log('Electron spawn error:', error.message));
  elec.unref();
  fs.closeSync(elecFd);
  log(`Electron spawned (pid=${elec.pid}), logs → electron_out.log`);

  log('\n=== All done! App should be visible ===');
  log(`Express: http://localhost:${PORT} (API server)`);
  log('Vite:    http://localhost:5173 (keep this terminal running)');
  log('Electron window should be showing the app.');
  log('Press F12 in Electron to open DevTools.');
}

main().catch(e => { log('FATAL:', e.message); process.exit(1); });