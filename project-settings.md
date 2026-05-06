# OMI-TED v2 PROJECT SETTINGS
*Read this before every task. Do not ask Rakshan about decisions already made here.*

---

## Project Identity
- **Name**: OMI-TED v2 (Telugu Christian Theology Translation Engine)
- **Repo**: github.com/rakshan-rakshan/omi-ted-v2
- **Local path** (both machines): `C:\Users\<user>\Projects\omi-ted-v2`
- **Phase**: 1 of 3 — transcript pipeline + parallel editor + dataset export
- **State**: Fresh start. v1 (`omi-automation`) is not carried forward.

---

## Pre-Code Validation (REQUIRED before M1)

Run this on 20 URLs from your Excel before writing any other code. If <70% succeed, the fallback strategy needs work before M1 can ship.

File: `backend/scripts/validate_transcripts.py`

```python
# Library: youtube-transcript-api >= 1.0 (v1.2.4 confirmed working).
# Pre-1.0 used YouTubeTranscriptApi.list_transcripts() as a classmethod;
# v1.x changed it to an instance method ytt.list(id). Do not revert.
from youtube_transcript_api import YouTubeTranscriptApi

test_ids = ["...", "..."]  # 20 IDs from your Excel

ytt = YouTubeTranscriptApi()

for vid_id in test_ids:
    try:
        tl = ytt.list(vid_id)
        te = tl.find_generated_transcript(['te'])
        en = te.translate('en').fetch()
        print(f"OK  {vid_id}: {len(list(en))} segments")
    except Exception as e:
        print(f"ERR {vid_id}: {type(e).__name__}: {e}")
```

If <70% succeed, run the yt-dlp fallback validator at `backend/scripts/validate_transcripts_ytdlp.py` before writing M1. Known failure mode for the library: YouTube IP-blocks transcript fetches from cloud or rate-limited residential IPs (`RequestBlocked` / `IpBlocked`). yt-dlp's browser-impersonating fetch usually still works.

Record both success rates in the Session 1 handoff.

---

## Model Routing Rules

| Task | Model | API string |
|------|-------|-----------|
| Architecture, multi-file reasoning, complex debugging | Opus 4.7 | `claude-opus-4-7` |
| Code generation, refactoring, module building | Sonnet 4.6 | `claude-sonnet-4-6` |
| Boilerplate, repetitive edits, formatting, doc writing | Haiku 4.5 | `claude-haiku-4-5-20251001` |

**Default for this project**: `claude-sonnet-4-6`.
**Switch to Opus only when**: task spans 3+ files OR requires reasoning about system-wide trade-offs.

---

## Architecture (locked — do not re-debate)

### Backend
- FastAPI (Python 3.11+)
- SQLAlchemy async + Alembic migrations
- Local DB: SQLite (`./dev.db`). Prod DB: PostgreSQL (Railway, deferred until M1–M4 work locally).
- Job queue: ARQ (async Redis) — only when batch processing >10 videos
- Server: `uvicorn main:app --reload` locally, Dockerfile on Railway later

### Frontend
- Next.js 14 (App Router)
- TanStack Table v8 for the editor
- Zustand for state
- SWR for API calls
- `next.config.js` rewrites proxy `/api/*` to backend (eliminates CORS — see v1 lessons below)

### LLM Router
- `config.yaml` controls provider: `sarvam` (default) | `google` | `openrouter` | `local`
- ONE function `translate(text, lang_pair)`. Provider is a config swap, never a code change.

### Infrastructure (deferred until local pipeline works)
- Backend: Railway
- Frontend: Vercel
- Monitoring: Sentry + PostHog
- GPU training (Phase 2): RunPod A100 + Unsloth LoRA

---

## Database Schema (canonical)

```sql
videos (id, youtube_id, title, channel, duration_s, status, fetched_at, created_at)
  status: pending | fetching | fetched | no_transcript | error

segments (id, video_id, segment_index, start_time, duration,
          te_original, en_auto, en_human, en_final,
          content_type, is_reviewed, quality_score, created_at)
  content_type: sermon | song | prayer | unknown
  en_final = en_human if set, else en_auto

jobs (id, video_id, status, error_msg, started_at, finished_at)
  status: queued | running | done | failed

glossary (id, te_term, en_term, category, notes)
  category: theology | name | place | general
```

---

## Module Build Order (do not skip ahead)

```
🔲 Pre-flight — validate_transcripts.py on 20 URLs (see Pre-Code Validation above)

🔲 M0 — Repo scaffold
   - Backend skeleton: main.py, database.py, config.yaml, .env.example
   - Frontend skeleton: Next.js 14 app router, base layout
   - Alembic init + first migration (001_initial_schema.py)
   - .gitignore, README.md
   - Verify: `uvicorn main:app --reload` returns /health 200

🔲 M1 — Transcript Ingest
   File: backend/routers/ingest.py
   - POST /api/v1/ingest/video {youtube_url}
   - Fetch te + en transcripts via youtube-transcript-api
   - Fallback: yt-dlp if library fails
   - Store in videos + segments tables
   - Mark content_type heuristic (<5 words = possible song)

🔲 M2 — DB + Migrations
   Files: backend/models.py, backend/database.py, alembic/
   - SQLite local, PG prod (same codebase via DATABASE_URL)

🔲 M3 — Parallel Editor UI
   Files: frontend/app/editor/[videoId]/page.tsx
   - 3-column table: Telugu | EN Auto | EN Human (editable)
   - Inline edit, auto-save on blur
   - Mark reviewed, quality rating (1–5)
   - Paginated 50 segments per page
   - Flag-as-song button

🔲 M4 — JSONL Export
   File: backend/routers/export.py
   - GET /api/v1/export/jsonl?quality_min=3&reviewed_only=true
   - Filter by reviewed | quality | content_type
   - Format: instruction-following JSONL
   - Separate songs dataset export

🔲 M5 — LLM Router
   File: backend/services/llm_router.py
   - Sarvam + Google + OpenRouter adapters behind one function
   - Translation cache: same te_text → skip API call

🔲 M6 — Batch Import (Excel → job queue)
   File: backend/routers/batch.py
   - POST /api/v1/batch/import (Excel upload)
   - Queue all URLs, background processing with 1–2s jitter rate limit

🔲 M7 — Fine-Tune Pipeline (Phase 2 — DO NOT BUILD until 500+ reviewed segments exist)
   RunPod + Unsloth + LoRA on Sarvam-Translate base
```

---

## File Structure

```
omi-ted-v2/
├── backend/                    # FastAPI
│   ├── main.py                 # App entry, router includes
│   ├── config.yaml             # LLM provider, model, env var refs
│   ├── database.py             # SQLAlchemy engine, session, Base
│   ├── models.py               # ORM models
│   ├── routers/
│   │   ├── ingest.py           # M1
│   │   ├── editor.py           # M3 (read/update endpoints)
│   │   ├── export.py           # M4
│   │   ├── batch.py            # M6
│   │   └── health.py           # /health
│   ├── services/
│   │   ├── llm_router.py       # M5
│   │   ├── transcript.py       # M1 (youtube-transcript-api wrapper)
│   │   └── song_detector.py    # M1 (heuristic content_type tagging)
│   ├── scripts/
│   │   └── validate_transcripts.py  # Pre-flight
│   ├── alembic/                # Migrations
│   ├── requirements.txt
│   ├── Dockerfile              # (later, for Railway)
│   └── nixpacks.toml           # (later — PYTHONPATH = ".")
│
├── frontend/                   # Next.js
│   ├── app/
│   │   ├── page.tsx            # Home → video list
│   │   ├── editor/[videoId]/   # M3
│   │   ├── videos/
│   │   └── dataset/            # M4 export controls
│   ├── lib/
│   │   ├── api.ts              # axios client → '/api/v1'
│   │   └── store.ts            # Zustand
│   ├── components/
│   │   └── ParallelEditor.tsx  # 3-column editable table
│   ├── next.config.js          # Proxy rewrites → backend
│   └── .env.local              # NEXT_PUBLIC_API_BASE
│
├── .handoffs/                  # Session handoffs (committed to git)
│   └── YYYYMMDD-NN-{kawin|rakshan}.md
│
├── CLAUDE.md
├── project-settings.md         # This file
├── HANDOFF-TEMPLATE.md
├── SYNC-WORKFLOW.md
├── setup.ps1
├── .gitignore
└── .env.example
```

---

## Environment Variables

**Backend `.env`**
```
DATABASE_URL=sqlite+aiosqlite:///./dev.db          # local
# DATABASE_URL=postgresql+asyncpg://...            # prod (Railway sets this later)
SARVAM_API_KEY=
OPENROUTER_API_KEY=sk-or-...
GOOGLE_TRANSLATE_API_KEY=
LLM_PROVIDER=sarvam
HOST=0.0.0.0
DEBUG=true                                         # local only
```

**Frontend `.env.local`**
```
NEXT_PUBLIC_API_BASE=http://localhost:8000         # local
# NEXT_PUBLIC_API_BASE=https://...railway.app      # prod (later)
```

---

## Git Workflow (two-machine sync)

Full discipline lives in `SYNC-WORKFLOW.md`. Quick reference:

### Windows / WSL safety

- Prefer Git for Windows when editing the Windows workspace at `C:\Users\<user>\Projects\omi-ted-v2`.
- If using WSL, prefer a native WSL2 ext4 clone such as `~/projects/omi-ted-v2` for edits and commits.
- Treat temporary clones as a last-resort workaround for reproducing or bypassing Windows mount issues; do not store credentials in clone URLs.

**End of session (mandatory):**
```powershell
# Fill .handoffs\YYYYMMDD-NN-{machine}.md from HANDOFF-TEMPLATE.md
git add -A
git commit -m "session: M{N} progress + handoff [{machine}]"
git push origin main
```

**Start of session on the other machine:**
```powershell
git pull --rebase origin main
Get-ChildItem .handoffs\*.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1
# Read it. Run the test command inside. Verify green. Begin.
```

**The 95% rule**: when Cowork shows ~95% context used, stop mid-thought, write the handoff, push, close. Do not try to "finish one more thing."

---

## When Rakshan says "build the next module"

1. Read this file (you should already have)
2. Find the first unchecked module in Module Build Order
3. Use AskUserQuestion only if scope is ambiguous (otherwise execute)
4. Build it. Test locally with real data.
5. Write the handoff.

---

## v1 lessons — watch for these in v2

These were resolved in v1 (`omi-automation`). v2 may hit them again. Apply the same fixes when they appear, do not re-debug from scratch.

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Network Error on all browser → API calls | Browser hitting Railway directly = CORS | Vercel proxy rewrites in `next.config.js` |
| Railway "1/1 replicas never became healthy" | Health check timeout < startup time | `healthcheckTimeout: 60` in `railway.json` |
| `ModuleNotFoundError` on Railway | PYTHONPATH unset in nixpacks | `PYTHONPATH = "."` in `nixpacks.toml` |
| Editor truncates at 500 segments | No pagination | Pagination must be built into M3 from day one |
| `/api/v1/reports/model-costs` 404 | Endpoint not implemented | Don't promise it on the frontend until backend has it |
