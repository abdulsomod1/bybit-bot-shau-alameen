const { execSync } = require('child_process');
try {
  const result = execSync('npx tsc -p tsconfig.main.json --noEmit', {
    cwd: 'C:/bot',
    encoding: 'utf8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  console.log('STDOUT:', result);
  console.log('SUCCESS - no type errors');
} catch(e) {
  console.log('STATUS:', e.status);
  console.log('STDOUT:', e.stdout);
  console.log('STDERR:', e.stderr);
}
