# OMI-TED v2 — Two-Machine Sync Workflow
*kawin (home, i7-8665U, 16GB) ⇄ rakshan (office, i7-12700KF, RTX 3050)*

---

## One-time setup (run on whichever machine creates the repo first)

```powershell
# From OneDrive\Cowork-Workspace\OUTPUTS\omi-ted-v2\ or wherever you keep it
cd C:\Users\rakshan\Projects
mkdir omi-ted-v2; cd omi-ted-v2

git init -b main
git remote add origin https://github.com/rakshan-rakshan/omi-ted-v2.git

# Move package contents in (CLAUDE.md, project-settings.md, setup.ps1, .handoffs/, etc.)
# Then:
git add .
git commit -m "chore: initial v2 scaffold"

# Create the repo on GitHub (gh CLI):
gh repo create rakshan-rakshan/omi-ted-v2 --private --source=. --push
```

If `gh` isn't installed, create the repo via web UI then:
```powershell
git push -u origin main
```

## On the second machine (first-time clone)

```powershell
cd C:\Users\<user>\Projects
git clone https://github.com/rakshan-rakshan/omi-ted-v2.git
cd omi-ted-v2
.\setup.ps1
```

## End of every session (before closing Cowork)

```powershell
# 1. Save handoff doc as .handoffs\YYYYMMDD-NN-{kawin|rakshan}.md (use template)
# 2. Commit + push:
git add .handoffs\
git add -A    # if code changes
git commit -m "session: M{N} progress + handoff [{machine}]"
git push origin main
```

## Start of every session (on the other machine)

```powershell
cd C:\Users\<user>\Projects\omi-ted-v2
git pull --rebase origin main

# Find the latest handoff:
Get-ChildItem .handoffs\*.md | Sort-Object LastWriteTime -Descending | Select-Object -First 1

# Read it. Run the "Test command" inside it. Verify green. Begin.
```

## .gitignore (ship this with the repo)

```
# Python
backend/venv/
backend/__pycache__/
backend/**/*.pyc
backend/.env
backend/dev.db
backend/dev.db-journal

# Node
frontend/node_modules/
frontend/.next/
frontend/.env.local

# IDE
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Cowork-specific (never commit OUTPUTS or local Cowork state)
OUTPUTS/
```

## The 95% rule (context window management)

When Cowork shows ~95% context used:
1. Stop mid-thought. Don't try to "finish one more thing."
2. Fill out `.handoffs/YYYYMMDD-NN-{machine}.md` from the template.
3. Commit + push.
4. Close the session.
5. Open a new session — on either machine — and do the pickup protocol.

The reason this works: handoff doc is the source of truth, not your memory and not Claude's context. Both Claudes get the same starting state from `git pull` + read handoff.

## Branch strategy

- `main` — handoffs, working code, what both machines pull from
- `omi-ted-backend` — Railway tracks this for backend deploys
- `claude/debug-backend-issues-DZMtf` — Vercel tracks this for frontend deploys

Daily work happens on `main`. Promote to deploy branches only when a module is verified working locally.

## What NOT to commit
- `.env` files (any of them)
- `dev.db` (SQLite local DB — different state on each machine)
- `venv/`, `node_modules/`, `.next/`
- API keys, even briefly — your existing security note: revoke immediately if pasted
