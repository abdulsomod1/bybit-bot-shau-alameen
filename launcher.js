#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const http = require('http');
const fs = require('fs');

const root = 'C:\\bot';
process.chdir(root);

function doExec(cmd, args) {
  console.log(`> ${cmd} ${args.join(' ')}`);
  execSync(cmd, args, { cwd: root, stdio: 'inherit' });
}

function waitFor(url, ms) {
  return new Promise((res) => {
    const deadline = Date.now() + ms;
    const tick = () => {
      if (Date.now() > deadline) return res(false);
      const req = http.get(url, (r) => { r.on('data', () => {}); res(true); });
      req.on('error', () => setTimeout(tick, 1500));
      req.setTimeout(3000, () => { try { req.destroy(); } catch(_) {} setTimeout(tick, 500); });
    };
    tick();
  });
}

async function main() {
  console.log('=== Bybit P2P Bot Launcher ===\n');

  // 1. Build
  console.log('[1/3] Building main process...');
  doExec('node', ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.main.json']);
  const mainJs = path.join(root, 'dist', 'main', 'main', 'main.js');
  if (!fs.existsSync(mainJs)) { console.error('main.js NOT FOUND!'); process.exit(1); }
  console.log('    Build OK\n');

  // 2. Start Vite (keeps running)
  console.log('[2/3] Starting Vite (http://localhost:5173)...');
  const vite = spawn(
    'node',
    [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host'],
    { cwd: root }
  );
  vite.stdout.on('data', (d) => process.stdout.write(d));
  vite.stderr.on('data', (d) => process.stderr.write(d));
  vite.on('error', (e) => console.error('Vite error:', e.message));
  vite.on('close', (c) => console.log('Vite closed:', c));

  const ok = await waitFor('http://localhost:5173', 30000);
  if (!ok) { vite.kill(); process.exit(1); }
  console.log('    Vite ready\n');

  await new Promise(r => setTimeout(r, 2000));

  // 3. Start Electron
  console.log('[3/3] Starting Electron...');
  const electronBin = path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe');
  const electron = spawn(electronBin, ['.'], { cwd: root, stdio: 'inherit' });
  electron.on('close', (c) => { console.log('Electron closed:', c); vite.kill(); process.exit(0); });
  electron.on('error', (e) => { console.error('Electron error:', e.message); vite.kill(); process.exit(1); });

  console.log('\n=== Bot is running! ===\n');
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1); });

