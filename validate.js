// validate.js - Run TypeScript validation on all configs
const { execSync } = require('child_process');

function check(name, cmd) {
  console.log(`\n=== ${name} ===`);
  try {
    const result = execSync(cmd, { cwd: 'c:/bot', encoding: 'utf8', timeout: 60000 });
    console.log(result || 'OK');
    return true;
  } catch (e) {
    console.log('ERROR:\n' + (e.stdout || e.stderr || e.message));
    return false;
  }
}

const r1 = check('Main', 'npx tsc -p tsconfig.main.json --noEmit');
const r2 = check('Server', 'npx tsc -p tsconfig.server.json --noEmit');
const r3 = check('Renderer', 'npx tsc -p tsconfig.json --noEmit');

console.log('\n=== SUMMARY ===');
console.log('Main:', r1 ? 'PASS' : 'FAIL');
console.log('Server:', r2 ? 'PASS' : 'FAIL');
console.log('Renderer:', r3 ? 'PASS' : 'FAIL');

process.exit(r1 && r2 && r3 ? 0 : 1);
