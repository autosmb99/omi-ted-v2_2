"""FastAPI entry point. Routers are mounted under /api/v1.

Run locally:  uvicorn main:app --reload
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import health, ingest, videos, export

app = FastAPI(
    title="OMI-TED v2",
    description="Telugu Christian theology translation engine.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(ingest.router, prefix="/api/v1/ingest", tags=["ingest"])
app.include_router(videos.router, prefix="/api/v1", tags=["videos"])
app.include_router(export.router, prefix="/api/v1", tags=["export"])
