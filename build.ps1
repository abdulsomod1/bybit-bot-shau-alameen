# Build script for Bybit P2P Bot
$ErrorActionPreference = 'Continue'
$workingDir = "C:\bot"

Write-Host "=== Bybit P2P Bot Build Script ===" -ForegroundColor Cyan

# Change to working directory
Set-Location $workingDir

# Step 1: Check node_modules
Write-Host "`n[1/4] Checking node_modules..." -ForegroundColor Yellow
if (Test-Path "$workingDir\node_modules") {
    Write-Host "  ✓ node_modules exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ node_modules MISSING - running npm install..." -ForegroundColor Red
    npm install 2>&1 | Out-Host
}

# Step 2: Type check main process
Write-Host "`n[2/4] Type checking main process..." -ForegroundColor Yellow
$tsOutput = npx tsc -p tsconfig.main.json --noEmit 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Type check passed" -ForegroundColor Green
} else {
    Write-Host "  ✗ Type errors found:" -ForegroundColor Red
    Write-Host $tsOutput
}

# Step 3: Build main process
Write-Host "`n[3/4] Building main process..." -ForegroundColor Yellow
npm run build:main 2>&1 | Out-Host
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ Main process built" -ForegroundColor Green
} else {
    Write-Host "  ✗ Build failed" -ForegroundColor Red
}

# Step 4: Verify build output
Write-Host "`n[4/4] Verifying build output..." -ForegroundColor Yellow
if (Test-Path "$workingDir\dist\main\main.js") {
    Write-Host "  ✓ dist\main\main.js exists" -ForegroundColor Green
} else {
    Write-Host "  ✗ dist\main\main.js NOT FOUND" -ForegroundColor Red
}

Write-Host "`n=== Build check complete ===" -ForegroundColor Cyan
Write-Host "Run 'npm run dev' to start the app in development mode."
