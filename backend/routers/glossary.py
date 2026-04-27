"""
Glossary endpoints.

GET    /api/v1/glossary                    — list all terms (filterable by category)
POST   /api/v1/glossary                    — create a new term
PATCH  /api/v1/glossary/{id}              — update a term
DELETE /api/v1/glossary/{id}              — delete a term
GET    /api/v1/glossary/lookup?te={word}  — quick lookup for editor hints
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import GlossaryTerm

router = APIRouter(tags=["glossary"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class GlossaryResponse(BaseModel):
    id: int
    te_term: str
    en_term: str
    category: str
    notes: str | None

    class Config:
        from_attributes = True


class GlossaryCreate(BaseModel):
    te_term: str
    en_term: str
    category: str = "general"
    notes: str | None = None


class GlossaryPatch(BaseModel):
    te_term: str | None = None
    en_term: str | None = None
    category: str | None = None
    notes: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

VALID_CATEGORIES = {"theology", "name", "place", "general"}


@router.get("/glossary", response_model=list[GlossaryResponse])
async def list_glossary(
    category: str | None = Query(None),
    session: AsyncSession = Depends(get_session),
) -> list[GlossaryResponse]:
    """Return all glossary terms, optionally filtered by category."""
    q = select(GlossaryTerm).order_by(GlossaryTerm.te_term)
    if category:
        q = q.where(GlossaryTerm.category == category)
    result = await session.execute(q)
    return [GlossaryResponse.model_validate(t) for t in result.scalars().all()]


@router.get("/glossary/lookup", response_model=list[GlossaryResponse])
async def lookup_glossary(
    te: str = Query(..., description="Telugu word or phrase to look up"),
    session: AsyncSession = Depends(get_session),
) -> list[GlossaryResponse]:
    """
    Quick lookup for the editor — returns terms where te_term contains `te`.
    Used for inline glossary hints while editing.
    """
    result = await session.execute(
        select(GlossaryTerm)
        .where(GlossaryTerm.te_term.contains(te))
        .order_by(GlossaryTerm.te_term)
        .limit(10)
    )
    return [GlossaryResponse.model_validate(t) for t in result.scalars().all()]


@router.post("/glossary", response_model=GlossaryResponse, status_code=201)
async def create_term(
    body: GlossaryCreate,
    session: AsyncSession = Depends(get_session),
) -> GlossaryResponse:
    """Create a new glossary term."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail=f"category must be one of {sorted(VALID_CATEGORIES)}",
        )
    existing = await session.execute(
        select(GlossaryTerm).where(GlossaryTerm.te_term == body.te_term.strip())
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=409,
            detail=f"Term '{body.te_term}' already exists in the glossary.",
        )
    term = GlossaryTerm(
        te_term=body.te_term.strip(),
        en_term=body.en_term.strip(),
        category=body.category,
        notes=body.notes,
    )
    session.add(term)
    await session.commit()
    await session.refresh(term)
    return GlossaryResponse.model_validate(term)


@router.patch("/glossary/{term_id}", response_model=GlossaryResponse)
async def update_term(
    term_id: int,
    body: GlossaryPatch,
    session: AsyncSession = Depends(get_session),
) -> GlossaryResponse:
    """Update a glossary term."""
    result = await session.execute(select(GlossaryTerm).where(GlossaryTerm.id == term_id))
    term = result.scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail=f"Term {term_id} not found.")

    if body.te_term is not None:
        term.te_term = body.te_term.strip()
    if body.en_term is not None:
        term.en_term = body.en_term.strip()
    if body.category is not None:
        if body.category not in VALID_CATEGORIES:
            raise HTTPException(
                status_code=422,
                detail=f"category must be one of {sorted(VALID_CATEGORIES)}",
            )
        term.category = body.category
    if body.notes is not None:
        term.notes = body.notes

    await session.commit()
    await session.refresh(term)
    return GlossaryResponse.model_validate(term)


@router.delete("/glossary/{term_id}", status_code=204, response_class=Response)
async def delete_term(
    term_id: int,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Delete a glossary term."""
    result = await session.execute(select(GlossaryTerm).where(GlossaryTerm.id == term_id))
    term = result.scalar_one_or_none()
    if term is None:
        raise HTTPException(status_code=404, detail=f"Term {term_id} not found.")
    await session.delete(term)
    await session.commit()
    return Response(status_code=204)
