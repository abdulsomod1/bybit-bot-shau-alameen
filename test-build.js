// test-build.js - Build + code quality test
// Run: node test-build.js
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const log = (...a) => console.log(...a);

const run = (cmd) => {
  try {
    return { ok: true, out: execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 30000 }) };
  } catch (e) {
    return { ok: false, stderr: (e.stderr || '').toString().slice(-600), stdout: (e.stdout || '').toString().slice(-600) };
  }
};

let pass = 0, fail = 0;
const results = [];
const test = (name, fn) => { try { fn(); results.push(name + ': OK'); pass++; } catch(e) { results.push(name + ': FAIL - ' + e.message); fail++; } };

log('=== BUILD + CODE QUALITY TESTS ===\n');

// File checks
test('01-files', () => {
  for (const f of ['package.json','tsconfig.json','src/main/main.ts','src/preload/preload.ts','src/server/index.ts','vite.config.ts','postcss.config.js']) {
    if (!fs.existsSync(path.join(ROOT, f))) throw new Error('Missing: ' + f);
  }
  log('  All project files present');
});

test('02-node_modules', () => {
  if (!fs.existsSync(path.join(ROOT, 'node_modules'))) throw new Error('run npm install first');
  log('  node_modules exists');
});

// Dist file checks
test('03-dist-main', () => {
  const f = path.join(ROOT, 'dist/main/main/main.js');
  if (!fs.existsSync(f)) throw new Error('run build-and-launch.js or node build-check.js');
  const sz = fs.statSync(f).size;
  if (sz < 500) throw new Error('too small: ' + sz + ' bytes');
  log('  main.js = ' + (sz/1024).toFixed(0) + 'KB');
});

test('04-dist-preload', () => {
  const f = path.join(ROOT, 'dist/main/preload.js');
  if (!fs.existsSync(f)) throw new Error('missing - rebuild needed');
  log('  preload.js = ' + (fs.statSync(f).size/1024).toFixed(0) + 'KB');
});

test('05-dist-renderer', () => {
  const f = path.join(ROOT, 'dist/renderer/index.html');
  if (!fs.existsSync(f)) throw new Error('missing - rebuild needed');
  const c = fs.readFileSync(f, 'utf-8');
  if (!c.includes('script')) throw new Error('no script tag in index.html');
  log('  index.html OK');
});

test('06-dist-server', () => {
  const f = path.join(ROOT, 'dist/server/index.js');
  if (!fs.existsSync(f)) throw new Error('missing - rebuild needed');
  if (!fs.readFileSync(f,'utf-8').includes('app.listen')) throw new Error('no app.listen');
  log('  server index.js OK');
});

// Code quality: the 3 fixes
test('07-no-inline-require', () => {
  const c = fs.readFileSync(path.join(ROOT, 'src/main/ipc-handlers.ts'), 'utf-8');
  // Check for require() not at top level
  if (/^\s+\S.*require\s*\(/.test(c) || /function\s+\w+\s*\([^)]*\)\s*\{[^}]*\brequire\s*\(/.test(c)) {
    throw new Error('inline require() found in ipc-handlers.ts');
  }
  log('  No inline require in ipc-handlers.ts');
});

test('08-no-node-fetch', () => {
  const c = fs.readFileSync(path.join(ROOT, 'src/main/services/ip-monitor.ts'), 'utf-8');
  if (c.includes("require('node-fetch')") || c.includes('require("node-fetch")')) {
    throw new Error('deprecated node-fetch require still present');
  }
  log('  No node-fetch require');
});

test('09-postcss-commonjs', () => {
  const c = fs.readFileSync(path.join(ROOT, 'postcss.config.js'), 'utf-8');
  if (c.includes('export default') || c.includes('export {')) throw new Error('still ESM');
  if (!c.includes('module.exports')) throw new Error('missing module.exports');
  log('  postcss.config.js uses CommonJS');
});

// TypeScript compilation checks (noEmit)
log('\n-- TypeScript compilation (noEmit) --');
for (const [label, cmd] of [
  ['10-ts-main', 'npx tsc -p tsconfig.main.json --noEmit 2>&1'],
  ['11-ts-server', 'npx tsc -p tsconfig.server.json --noEmit 2>&1'],
  ['12-ts-preload', 'npx tsc -p src/preload/tsconfig.json --noEmit 2>&1'],
]) {
  test(label, () => {
    const r = run(cmd);
    if (!r.ok) {
      const err = r.stderr || r.stdout || 'unknown error';
      throw new Error(err.slice(0, 300));
    }
    log(`  ${label}: compiled OK`);
  });
}

// Vite build
test('13-vite-build', () => {
  const r = run('npx vite build 2>&1');
  if (!r.ok) throw new Error((r.stderr || r.stdout || '').slice(0,300));
  log('  vite build OK');
});

// Summary
log('\n=== SUMMARY ===');
log(`  Passed: ${pass}   Failed: ${fail}`);
for (const r of results) log('  ' + r);
log('');
if (fail > 0) { log('SOME TESTS FAILED'); process.exit(1); }
else { log('ALL BUILD + CODE QUALITY TESTS PASSED!'); process.exit(0); }
