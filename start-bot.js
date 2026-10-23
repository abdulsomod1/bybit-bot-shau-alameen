// start-bot.js — builds and launches the bot, writes output to bot_run.log
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname);
const log = path.join(root, 'bot_run.log');
const f = fs.openSync(log, 'w');
const print = (msg) => {
  const line = msg + '\n';
  fs.writeSync(f, line);
  process.stdout.write(msg + '\n');
};

function exe(cmd, label, ms) {
  print(`\n[${label}] Running: ${cmd}`);
  try {
    execSync(cmd, { cwd: root, timeout: ms || 120000, shell: true });
    print(`[${label}] ✓ Done`);
    return true;
  } catch(e) {
    const s = e.status != null ? `exit ${e.status}` : e.message;
    print(`[${label}] ✗ ${s}`);
    return false;
  }
}

function exe2(cmd, args, label, ms) {
  print(`\n[${label}] Running: ${cmd} ${args.join(' ')}`);
  try {
    execSync(cmd, args, { cwd: root, timeout: ms || 120000, shell: true });
    print(`[${label}] ✓ Done`);
    return true;
  } catch(e) {
    const s = e.status != null ? `exit ${e.status}` : e.message;
    print(`[${label}] ✗ ${s}`);
    return false;
  }
}

try {
  print('=== Bot Build & Launch ===');
  print('Root: ' + root);

  // 1. Build main
  if (!exe('npx tsc -p tsconfig.main.json', 'build:main')) {
    fs.closeSync(f);
    process.exit(1);
  }

  // 2. Build preload
  if (!exe('npx tsc -p src\\preload\\tsconfig.json', 'build:preload')) {
    fs.closeSync(f);
    process.exit(1);
  }

  // 3. Verify
  const mainOk = fs.existsSync(path.join(root, 'dist', 'main', 'main', 'main.js'));
  const preloadOk = fs.existsSync(path.join(root, 'dist', 'main', 'preload.js'));
  print(`\nVerify: main.js=${mainOk} preload.js=${preloadOk}`);
  if (!mainOk || !preloadOk) {
    print('BUILD OUTPUTS MISSING — cannot launch');
    fs.closeSync(f);
    process.exit(1);
  }

  // 4. Vite dev server (detached)
  print('\n[dev:vite] Starting Vite dev server (background)...');
  const vite = spawn('npx', ['vite', '--port', '5173', '--host', '0.0.0.0'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: true,
  });
  vite.unref();
  print(`[dev:vite] Vite spawned (pid should appear above). Waiting 12s...`);
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    const left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    print(`  waiting ${left}s...`);
    const s = Date.now();
    while (Date.now() - s < 1000) {}
  }

  // 5. Electron (detached)
  print('\n[electron] Starting Electron (background)...');
  const elec = spawn('npx', ['electron', '.'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    shell: true,
  });
  elec.unref();
  print('[electron] Electron spawned. Check desktop for window.');

  print('\n=== SUCCESS — Bot is launching! ===');
  print('Vite: http://localhost:5173');
  print(`Full log: ${log}`);

  fs.closeSync(f);
  process.exit(0);
} catch(err) {
  print('FATAL: ' + err.message);
  try { fs.closeSync(f); } catch(_) {}
  process.exit(1);
}