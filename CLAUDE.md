# CLAUDE.md
*Read this first. Every session.*

**Project**: OMI-TED v2 — Telugu Christian theology translation engine.
**Phase**: 1 — transcript pipeline + parallel editor + dataset export.

## Read order at session start
1. `project-settings.md` — architecture decisions, module order, model routing, git workflow
2. Latest file in `.handoffs/` (sorted by date) — what the previous session ended on
3. Then begin

## The one rule
Local first. If `uvicorn main:app --reload` doesn't work on localhost, do not touch Railway or Vercel.

## End of session
Fill `.handoffs/YYYYMMDD-NN-{kawin|rakshan}.md` from `HANDOFF-TEMPLATE.md`. Commit + push before closing Cowork.
