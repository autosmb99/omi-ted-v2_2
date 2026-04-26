# OMI-TED v2

Telugu Christian theology translation engine. Phase 1: transcript pipeline + parallel editor + dataset export.

---

## Quick start (local)

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Copy env template and fill in keys
cp ..\\.env.example .env

# Create the database (SQLite locally)
alembic upgrade head

# Start the API
uvicorn main:app --reload
# → http://localhost:8000/health  {"status":"ok","service":"omi-ted-v2"}
# → http://localhost:8000/docs    Swagger UI
```

### Frontend

```powershell
cd frontend
cp .env.local.example .env.local   # edit if backend port differs
npm install
npm run dev
# → http://localhost:3000
```

The Next.js dev server proxies `/api/*` → `http://localhost:8000/api/*` automatically via `next.config.js`. No CORS config needed.

---

## Project layout

```
backend/
  main.py              FastAPI entry point
  database.py          Async SQLAlchemy engine + session dependency
  models.py            ORM: Video, Segment, Job, GlossaryTerm
  config.yaml          LLM provider routing (sarvam | google | openrouter | local)
  requirements.txt
  alembic/             Migrations
  routers/             API route modules (M1+ mounted here)
  scripts/
    validate_transcripts.py        Pre-flight: youtube-transcript-api
    validate_transcripts_ytdlp.py  Pre-flight: yt-dlp fallback with browser cookie cascade

frontend/
  app/                 Next.js App Router pages
    layout.tsx         Shell + header
    page.tsx           Video list (placeholder until M1)
  lib/
    api.ts             Axios client → /api/v1/*
    store.ts           Zustand global state
  next.config.js       Proxy rewrites (eliminates CORS)

.handoffs/             Session handoffs — read before starting each session
project-settings.md    Architecture decisions, module order, model routing
HANDOFF-TEMPLATE.md    Template for end-of-session handoffs
```

---

## Module build order

| # | Module | What it builds |
|---|--------|----------------|
| M0 | Scaffold | Backend skeleton, DB schema, /health ✅ |
| M1 | Transcript ingest | Fetch te + en transcripts, populate videos/segments |
| M2 | Video list API | GET /api/v1/videos with pagination + status filter |
| M3 | Parallel editor | 3-column TanStack table: te / en_auto / en_human |
| M4 | Dataset export | JSONL + CSV export for fine-tuning |
| M5 | LLM translation | Sarvam/Google translate → en_auto via config.yaml |

## Environment variables

See `.env.example` (backend) and `frontend/.env.local.example` (frontend).

## Two-machine sync

Read `SYNC-WORKFLOW.md`. TL;DR: fill `.handoffs/YYYYMMDD-NN-{machine}.md`, `git add -A && git commit && git push` at end of every session.
