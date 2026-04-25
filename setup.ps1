# OMI-TED v2 Local Setup — Windows 11 / PowerShell
# Run from repo root: .\setup.ps1

Write-Host "OMI-TED v2 Local Setup" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan

# 1. Backend venv
Write-Host "`n[1/5] Creating Python venv..." -ForegroundColor Yellow
Set-Location backend
if (-not (Test-Path venv)) {
    python -m venv venv
}
.\venv\Scripts\Activate.ps1

# 2. Backend deps
Write-Host "`n[2/5] Installing backend deps..." -ForegroundColor Yellow
if (Test-Path requirements.txt) {
    pip install -r requirements.txt
} else {
    Write-Host "WARNING: requirements.txt missing. Falling back to ad-hoc install." -ForegroundColor Red
    pip install fastapi uvicorn[standard] sqlalchemy aiosqlite alembic youtube-transcript-api yt-dlp httpx pandas python-dotenv sentry-sdk pyyaml
}

# 3. Env file
Write-Host "`n[3/5] Setting up .env..." -ForegroundColor Yellow
if (-not (Test-Path .env)) {
    Copy-Item .env.example .env
    Write-Host ".env created from .env.example — fill in API keys" -ForegroundColor Green
}

# 4. Migrations (only if migration files exist)
Write-Host "`n[4/5] Running migrations..." -ForegroundColor Yellow
if ((Test-Path alembic\versions) -and ((Get-ChildItem alembic\versions -Filter *.py | Measure-Object).Count -gt 0)) {
    alembic upgrade head
} else {
    Write-Host "No migrations found yet — skipping. Run alembic revision --autogenerate after defining models." -ForegroundColor Yellow
}

# 5. Frontend
Write-Host "`n[5/5] Installing frontend deps..." -ForegroundColor Yellow
Set-Location ..\frontend
if (Test-Path package.json) {
    pnpm install
} else {
    Write-Host "frontend/package.json missing — skipping." -ForegroundColor Red
}

Set-Location ..
Write-Host "`n======================" -ForegroundColor Cyan
Write-Host "Setup complete." -ForegroundColor Green
Write-Host "`nStart backend:  cd backend; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload"
Write-Host "Start frontend: cd frontend; pnpm dev"
Write-Host "Health check:   http://localhost:8000/health"
