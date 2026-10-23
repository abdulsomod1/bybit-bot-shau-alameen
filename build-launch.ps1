#!/usr/bin/env node
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = 'C:\\bot';
process.chdir(root);

function run(cmd, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, [], {
      shell: true,
      stdio: 'inherit',
      cwd: root,
      ...opts
    });
    child.on('close', (code) => resolve(code));
    child.on('error', (err) => { console.error('ERROR:', err.message); resolve(1); });
  });
}

async function main() {
  console.log('=== Bybit P2P Bot Launch ===');

  // 1. Install deps
  console.log('\n[1] npm install...');
  let code = await run('npm install', { stdio: 'pipe' });
  if (code !== 0) { console.log('npm install failed'); process.exit(1); }

  // 2. Build main
  console.log('\n[2] Building main process...');
  code = await run('npx tsc -p tsconfig.main.json', { stdio: 'pipe' });
  if (code !== 0) {
    console.log('TypeScript errors - trying build anyway...');
  }
  code = await run('npm run build:main', { stdio: 'pipe' });
  if (code !== 0) { console.log('build:main failed'); process.exit(1); }
  if (!fs.existsSync(path.join(root, 'dist', 'main', 'main.js'))) {
    console.error('dist/main/main.js NOT FOUND after build!');
    process.exit(1);
  }
  console.log('Build OK');

  // 3. Start Vite in background
  console.log('\n[3] Starting Vite dev server...');
  const vite = spawn('npx', ['vite'], {
    shell: true,
    cwd: root,
    stdio: 'pipe'
  });
  vite.stdout.on('data', (d) => process.stdout.write(d));
  vite.stderr.on('data', (d) => process.stderr.write(d));

  // 4. Wait for Vite to be ready
  console.log('Waiting for Vite (http://localhost:5173)...');
  await new Promise(r => setTimeout(r, 10000));

  // 5. Start Electron
  console.log('\n[4] Starting Electron...');
  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    cwd: root,
    stdio: 'inherit'
  });

  electron.on('close', () => {
    vite.kill();
    process.exit(0);
  });
}

main().catch(e => { console.error(e); process.exit(1); });

