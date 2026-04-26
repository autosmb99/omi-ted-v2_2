"""FastAPI entry point. Routers are mounted under /api/v1.

Run locally:  uvicorn main:app --reload
"""
from __future__ import annotations

from fastapi import FastAPI

from routers import health, ingest

app = FastAPI(
    title="OMI-TED v2",
    description="Telugu Christian theology translation engine.",
    version="0.1.0",
)

# Health check is unprefixed so Railway's healthcheck can hit it directly.
app.include_router(health.router)

# M1 — transcript ingest
app.include_router(ingest.router, prefix="/api/v1/ingest", tags=["ingest"])

# Future routers (M2+)
# app.include_router(editor.router, prefix="/api/v1/editor", tags=["editor"])
# app.include_router(export.router, prefix="/api/v1/export", tags=["export"])
# app.include_router(batch.router,  prefix="/api/v1/batch",  tags=["batch"])
