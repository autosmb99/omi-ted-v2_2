# OMI-TED v2 — Session Handoff
*Copy this file to `.handoffs/YYYYMMDD-NN-{kawin|rakshan}.md` at session end. Commit + push before closing.*

---

## Session Identity
- **Session #**: 00
- **Machine**: kawin | rakshan
- **Date/time started**: YYYY-MM-DD HH:MM IST
- **Date/time ended**: YYYY-MM-DD HH:MM IST
- **Context tokens used (approx)**: 0% / 95% trigger threshold
- **Model used**: claude-sonnet-4-6 | claude-opus-4-7 | claude-haiku-4-5-20251001

## Repo State
- **Branch**: omi-ted-backend | claude/debug-backend-issues-DZMtf | other
- **Last commit SHA**: (paste `git rev-parse HEAD`)
- **Last commit message**: (paste `git log -1 --pretty=%s`)
- **Uncommitted changes**:
```
(paste output of `git status --short`)
```
- **Stash entries**: (paste `git stash list` if anything stashed)

## Local Environment State
- **Backend running**: yes/no — port 8000
- **Frontend running**: yes/no — port 3000
- **DB in use**: SQLite (`./dev.db`) | PostgreSQL (Railway)
- **Migration version**: (paste `alembic current`)
- **Row counts**: videos=0, segments=0, jobs=0, glossary=0
- **LLM provider in config.yaml**: sarvam | google | openrouter | local
- **Sentry/PostHog connected**: yes/no

## What I Just Completed
- Module: M1 | M2 | M3 | M4 | M5 | M6 | M7
- Files touched:
  - `backend/routers/ingest.py` — added X
  - `backend/services/transcript.py` — refactored Y
- Tests run: (paste exact command + result)
- Verification: (what proves it works — endpoint hit, row inserted, JSONL written)

## What's Next (next session starts here)
- **Module**: (which one)
- **File**: `backend/...`
- **Function**: `function_name` at line N
- **First action**: (one sentence)
- **Test command to verify pickup works**:
```powershell
cd backend; .\venv\Scripts\Activate.ps1; uvicorn main:app --reload
```

## Blockers
- (anything that needs Rakshan's decision — list as one-liners or "none")

## Notes for Next Session
- (anything weird, half-thought-out, or worth remembering — keep brief)

---

## Pickup Protocol (read this when starting on the other machine)
1. `git pull --rebase origin main`
2. Read the most recent file in `.handoffs/`
3. Run the test command in "What's Next" — confirm green
4. Open the file at the function in "What's Next"
5. Begin
