# Full restart script - compiles and starts the server
$ErrorActionPreference = 'Continue'
$root = 'C:\bot'
Set-Location $root

Write-Host "=== Restarting Bot Server ===" -ForegroundColor Cyan

# Kill node
Write-Host "[1/4] Killing old server..."
taskkill /f /im node.exe 2>$null
Start-Sleep 2

# Compile
Write-Host "[2/4] Compiling TypeScript..."
$tsc = Start-Process npx -ArgumentList "tsc" -WorkingDirectory $root -NoNewWindow -Wait -PassThru
if ($tsc.ExitCode -eq 0) {
    Write-Host "[OK] TypeScript compiled" -ForegroundColor Green
} else {
    Write-Host "[WARN] TypeScript had issues, using pre-compiled files" -ForegroundColor Yellow
}

# Start server
Write-Host "[3/4] Starting server..."
$log = "$root\server_log.txt"
$proc = Start-Process node -ArgumentList "dist/server/index.js" -WorkingDirectory $root -NoNewWindow -PassThru -RedirectStandardOutput $log -RedirectStandardError "$root\server_err.txt"

Start-Sleep 3

if ($proc.HasExited) {
    Write-Host "[ERROR] Server crashed! Exit code: $($proc.ExitCode)" -ForegroundColor Red
    Write-Host "Check: $log and $root\server_err.txt" -ForegroundColor Yellow
} else {
    Write-Host "[OK] Server running! PID: $($proc.Id)" -ForegroundColor Green
}

# Check health
Start-Sleep 2
Write-Host "[4/4] Checking health..."
try {
    $r = Invoke-WebRequest "http://localhost:3000/health" -TimeoutSec 5 -UseBasicParsing
    Write-Host "[OK] Server health: $($r.Content)" -ForegroundColor Green
} catch {
    Write-Host "[WARN] Health check failed: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Server ready! ===" -ForegroundColor Cyan
Write-Host "Server log: $log"
