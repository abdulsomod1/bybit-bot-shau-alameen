// build-check.js - Build check with file output
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = 'C:\\bot';
const LOG_FILE = path.join(ROOT, 'build_check_log2.txt');

// Clear log
fs.writeFileSync(LOG_FILE, '');

function log(msg) {
  const line = msg + '\n';
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

log('=== Build Check Starting ===');

function run(cmd, label, timeout) {
  log(`\n[${label}] EXEC: ${cmd}`);
  try {
    const r = execSync(cmd, { cwd: ROOT, timeout: timeout || 120000, windowsHide: false });
    const result = r ? r.toString() : '(no output)';
    log(`[${label}] OK\n${result.trim()}`);
    return { ok: true, result };
  } catch(e) {
    const so = e.stdout ? e.stdout.toString() : '';
    const se = e.stderr ? e.stderr.toString() : '';
    log(`[${label}] EXIT ${e.status || 'ERROR'}\nSTDOUT:\n${so}\nSTDERR:\n${se}`);
    return { ok: false, stdout: so, stderr: se, status: e.status };
  }
}

// 1. Build renderer
const r1 = run('npx vite build 2>&1', 'build:renderer');

// 2. Build main
const r2 = run('npx tsc -p tsconfig.main.json 2>&1', 'build:main');

// 3. Build preload
const r3 = run('npx tsc -p src\\preload\\tsconfig.json 2>&1', 'build:preload');

// 4. Build server
const r4 = run('npx tsc -p tsconfig.server.json 2>&1', 'build:server');

log('\n=== SUMMARY ===');
log('Renderer: ' + (r1.ok ? 'OK' : 'FAIL'));
log('Main: ' + (r2.ok ? 'OK' : 'FAIL'));
log('Preload: ' + (r3.ok ? 'OK' : 'FAIL'));
log('Server: ' + (r4.ok ? 'OK' : 'FAIL'));

const allOk = r1.ok && r2.ok && r3.ok && r4.ok;
log('\nOverall: ' + (allOk ? 'SUCCESS' : 'FAILED'));
log('Log written to: ' + LOG_FILE);

process.exit(allOk ? 0 : 1);
