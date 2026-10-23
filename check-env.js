// Diagnostic script to verify the bot's build state
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = 'c:\\bot';
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

// Check dist/main/main/main.js
const mainJsExists = fs.existsSync(path.join(root, 'dist\\main\\main\\main.js'));
check('dist/main/main/main.js (compiled)', mainJsExists, mainJsExists ? 'exists' : 'MISSING - run build:main');
check('dist/main/preload.js (compiled)', fs.existsSync(path.join(root, 'dist\\main\\preload.js')), fs.existsSync(path.join(root, 'dist\\main\\preload.js')) ? 'exists' : 'MISSING - run build:preload');

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
  execSync('cd /d c:\\bot && npx tsc -p tsconfig.main.json --noEmit', { 
    stdio: 'inherit', 
    timeout: 60000,
    windowsHide: true 
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
