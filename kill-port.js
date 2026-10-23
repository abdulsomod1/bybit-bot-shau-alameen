// kill-port.js — find and kill the process on port 3000
const { execSync } = require('child_process');
try {
  const out = execSync('netstat -ano | findstr :3000 | findstr LISTEN', { encoding: 'utf8', timeout: 5000 });
  const lines = out.trim().split('\n').filter(l => l.trim());
  if (lines.length === 0) { console.log('No process on 3000'); process.exit(0); }
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    console.log('Killing PID', pid);
    execSync('taskkill /F /PID ' + pid, { timeout: 5000 });
  }
  console.log('Done');
} catch (e) { console.log('Nothing to kill or error:', e.message); }
