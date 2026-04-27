# OMI-TED v2 - Dev launcher
# Run from the project root: .\start-dev.ps1
# Installs dependencies if needed, then opens backend + frontend in separate windows.

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"

# ── Check .env ────────────────────────────────────────────────────────────
$envFile = Join-Path $BackendDir ".env"
if (-not (Test-Path $envFile)) {
    $exampleFile = Join-Path $BackendDir ".env.example"
    if (Test-Path $exampleFile) {
        Copy-Item $exampleFile $envFile
        Write-Host "Created backend\.env from .env.example - fill in your API keys." -ForegroundColor Yellow
    } else {
        Write-Host "WARNING: backend\.env not found." -ForegroundColor Yellow
    }
}

# ── Install Python dependencies ───────────────────────────────────────────
Write-Host "Checking Python packages..." -ForegroundColor Cyan
$reqFile = Join-Path $BackendDir "requirements.txt"
python -m pip install -r $reqFile --quiet --disable-pip-version-check
if ($LASTEXITCODE -ne 0) {
    Write-Host "pip install failed. Check your Python installation." -ForegroundColor Red
    exit 1
}
Write-Host "Python packages OK." -ForegroundColor Green

# ── Run database migrations ───────────────────────────────────────────────
Write-Host "Running Alembic migrations..." -ForegroundColor Cyan
Push-Location $BackendDir
python -m alembic upgrade head 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Alembic migration failed - database may be out of date." -ForegroundColor Yellow
}
Pop-Location
Write-Host "Database OK." -ForegroundColor Green

# ── Install frontend dependencies if node_modules missing ─────────────────
$nodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Write-Host "Installing frontend npm packages (first run)..." -ForegroundColor Cyan
    Push-Location $FrontendDir
    npm install --silent
    Pop-Location
}

# ── Start backend in a new window ────────────────────────────────────────
Write-Host "Starting backend  (uvicorn -> http://localhost:8000) ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$BackendDir'; Write-Host 'BACKEND - http://localhost:8000' -ForegroundColor Cyan; python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
) -WindowStyle Normal

# Give backend a moment to bind before frontend starts
Start-Sleep -Seconds 3

# ── Start frontend in a new window ───────────────────────────────────────
Write-Host "Starting frontend (Next.js  -> http://localhost:3000) ..." -ForegroundColor Magenta
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$FrontendDir'; Write-Host 'FRONTEND - http://localhost:3000' -ForegroundColor Magenta; npm run dev"
) -WindowStyle Normal

# ── Done ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "Both servers are starting. Open your browser at:" -ForegroundColor Green
Write-Host "  App  -> http://localhost:3000" -ForegroundColor White
Write-Host "  API  -> http://localhost:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "To stop: close the two terminal windows that opened." -ForegroundColor DarkGray
