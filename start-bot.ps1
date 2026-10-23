$ErrorActionPreference = "Continue"
Set-Location c:\bot

Write-Host "=== Bybit P2P Bot Startup ===" -ForegroundColor Cyan
Write-Host ""

Write-Host "[1] Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVer = node --version
    Write-Host "  Node: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[2] Checking npm..." -ForegroundColor Yellow
try {
    $npmVer = npm --version
    Write-Host "  npm: $npmVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: npm not found!" -ForegroundColor Red
    exit 1
}

Write-Host "[3] Checking node_modules..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "  Found" -ForegroundColor Green
} else {
    Write-Host "  Missing - installing dependencies..." -ForegroundColor Red
    Write-Host "  Running: npm install" -ForegroundColor Gray
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  npm install FAILED" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Dependencies installed" -ForegroundColor Green
}

Write-Host "[4] Building TypeScript (main process)..." -ForegroundColor Yellow
npm run build:main
if ($LASTEXITCODE -ne 0) {
    Write-Host "  build:main FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "  Main build OK" -ForegroundColor Green

Write-Host "[5] Building TypeScript (preload)..." -ForegroundColor Yellow
npm run build:preload
if ($LASTEXITCODE -ne 0) {
    Write-Host "  build:preload FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "  Preload build OK" -ForegroundColor Green

Write-Host "[6] Building renderer (Vite)..." -ForegroundColor Yellow
npm run build:renderer
if ($LASTEXITCODE -ne 0) {
    Write-Host "  build:renderer FAILED" -ForegroundColor Red
    exit 1
}
Write-Host "  Renderer build OK" -ForegroundColor Green

Write-Host ""
Write-Host "=== Build complete! Starting application... ===" -ForegroundColor Cyan
Write-Host ""

# Check for .env file
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found. Copy .env.example to .env and configure it." -ForegroundColor Yellow
    Write-Host ""
}

# Start the application
# Option 1: Electron app (with Vite dev server)
# Option 2: Express server only
Write-Host "Choose startup mode:" -ForegroundColor Cyan
Write-Host "  1 - Electron app (full desktop experience)" -ForegroundColor White
Write-Host "  2 - Express API server only (web interface)" -ForegroundColor White
Write-Host ""

$mode = Read-Host "Enter choice (1 or 2)"

if ($mode -eq "1") {
    Write-Host "Starting Electron app..." -ForegroundColor Cyan
    npm run dev
} elseif ($mode -eq "2") {
    Write-Host "Building server..." -ForegroundColor Cyan
    npm run build:server
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  build:server FAILED" -ForegroundColor Red
        exit 1
    }
    Write-Host "Starting Express server..." -ForegroundColor Cyan
    Write-Host "  API: http://localhost:3000" -ForegroundColor Gray
    Write-Host "  Health: http://localhost:3000/health" -ForegroundColor Gray
    Write-Host ""
    npm start
} else {
    Write-Host "Invalid choice. Starting Electron by default..." -ForegroundColor Yellow
    npm run dev
}
