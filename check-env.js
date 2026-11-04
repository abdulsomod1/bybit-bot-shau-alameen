// Diagnostic script to verify the bot's build state
import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const results = [];

function check(name, condition, details) {
  const status = condition ? 'PASS' : 'FAIL';
  results.push({ name, status, details });
  console.log(`[${status}] ${name}${details ? ': ' + details : ''}`);
}

console.log('=== Bybit P2P Bot Environment Check ===\n');

// Node version
try {
  const nodeVersion = process.version;
  check('Node.js', true, nodeVersion);
} catch(e) {
  check('Node.js', false, e.message);
}

// Check node_modules
const nmExists = fs.existsSync(path.join(root, 'node_modules'));
check('node_modules', nmExists, nmExists ? 'exists' : 'MISSING - run npm install');

// Check package.json
const pkgExists = fs.existsSync(path.join(root, 'package.json'));
check('package.json', pkgExists);

// Check compiled application entry points
const mainJsExists = fs.existsSync(path.join(root, 'dist', 'main', 'main', 'main.js'));
check('dist/main/main/main.js (compiled)', mainJsExists, mainJsExists ? 'exists' : 'MISSING - run build:main');
const preloadExists = fs.existsSync(path.join(root, 'dist', 'main', 'preload.js'));
check('dist/main/preload.js (compiled)', preloadExists, preloadExists ? 'exists' : 'MISSING - run build:preload');
const rendererExists = fs.existsSync(path.join(root, 'dist', 'renderer', 'index.html'));
check('dist/renderer/index.html (compiled)', rendererExists, rendererExists ? 'exists' : 'MISSING - run build:renderer');
const serverExists = fs.existsSync(path.join(root, 'dist', 'server', 'index.js'));
check('dist/server/index.js (compiled)', serverExists, serverExists ? 'exists' : 'MISSING - run build:server');

// Check ipc-handlers.ts
const ipcExists = fs.existsSync(path.join(root, 'src\\main\\ipc-handlers.ts'));
check('src/main/ipc-handlers.ts', ipcExists, ipcExists ? 'exists' : 'MISSING');

// Check key source files
const keyFiles = [
  'src/main/main.ts',
  'src/preload/preload.ts',
  'src/main/services/database.ts',
  'src/main/services/bot-worker.ts',
  'src/main/services/bybit-api.ts',
  'src/main/services/ip-monitor.ts',
  'src/renderer/App.tsx',
];
for (const f of keyFiles) {
  check(f, fs.existsSync(path.join(root, f)), null);
}

// Try TypeScript check
console.log('\n--- TypeScript Check ---');
try {
  execFileSync(process.execPath, [
    path.join(root, 'node_modules', 'typescript', 'bin', 'tsc'),
    '-p',
    'tsconfig.main.json',
    '--noEmit',
  ], {
    cwd: root,
    stdio: 'inherit', 
    timeout: 60000,
    windowsHide: true,
  });
  check('TypeScript check', true);
} catch(e) {
  check('TypeScript check', false, 'errors found');
}

console.log('\n=== Summary ===');
const passed = results.filter(r => r.status === 'PASS').length;
const failed = results.filter(r => r.status === 'FAIL').length;
console.log(`Passed: ${passed}, Failed: ${failed}`);
if (failed > 0) {
  console.log('FAILED checks:');
  results.filter(r => r.status === 'FAIL').forEach(r => console.log(' - ' + r.name));
}
process.exit(failed > 0 ? 1 : 0);
