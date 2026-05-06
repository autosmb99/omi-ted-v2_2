"""
Video and segment endpoints.

GET    /api/v1/videos                       — list all videos
GET    /api/v1/videos/{youtube_id}/segments — paginated segments for one video
DELETE /api/v1/videos/{youtube_id}          — delete a video and all segments
PATCH  /api/v1/segments/{segment_id}        — save human translation + review flag
GET    /api/v1/tm/search                    — fuzzy translation memory lookup
"""
from __future__ import annotations

from math import ceil

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Job, Segment, Video, TranslationMemory, SegmentRevision

router = APIRouter(tags=["videos"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class VideoSummary(BaseModel):
    id: int
    youtube_id: str
    title: str | None
    channel: str | None
    duration_s: int | None
    status: str
    segment_count: int
    fetched_at: str | None
    error_msg: str | None = None

    class Config:
        from_attributes = True


class SegmentResponse(BaseModel):
    id: int
    segment_index: int
    start_time: float
    duration: float
    te_original: str
    en_auto: str | None
    en_human: str | None
    en_final: str | None
    content_type: str
    is_reviewed: bool
    quality_score: int | None

    class Config:
        from_attributes = True


class SegmentsPage(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[SegmentResponse]


class SegmentPatch(BaseModel):
    en_human: str | None = None
    is_reviewed: bool | None = None
    quality_score: int | None = None
    content_type: str | None = None


class TMSearchResult(BaseModel):
    te_text: str
    en_text: str
    similarity: float  # 0-1 rough score


class TMSearchResponse(BaseModel):
    query: str
    results: list[TMSearchResult]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/videos", response_model=list[VideoSummary])
async def list_videos(
    session: AsyncSession = Depends(get_session),
) -> list[VideoSummary]:
    """Return all videos with segment counts and latest job error_msg."""
    error_msg_subq = (
        select(Job.error_msg)
        .where(Job.video_id == Video.id)
        .where(Job.error_msg.isnot(None))
        .order_by(Job.id.desc())
        .limit(1)
        .correlate(Video)
        .scalar_subquery()
    )

    result = await session.execute(
        select(
            Video,
            func.count(Segment.id).label("segment_count"),
            error_msg_subq.label("error_msg"),
        )
        .outerjoin(Segment, Segment.video_id == Video.id)
        .group_by(Video.id)
        .order_by(Video.id.desc())
    )
    rows = result.all()
    return [
        VideoSummary(
            id=video.id,
            youtube_id=video.youtube_id,
            title=video.title,
            channel=video.channel,
            duration_s=video.duration_s,
            status=video.status,
            segment_count=count,
            fetched_at=video.fetched_at.isoformat() if video.fetched_at else None,
            error_msg=error_msg,
        )
        for video, count, error_msg in rows
    ]


@router.delete("/videos/{youtube_id}", status_code=204, response_class=Response)
async def delete_video(
    youtube_id: str,
    session: AsyncSession = Depends(get_session),
) -> Response:
    """Delete a video and all its segments (cascade)."""
    result = await session.execute(
        select(Video).where(Video.youtube_id == youtube_id)
    )
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=404, detail=f"Video {youtube_id} not found.")
    await session.delete(video)
    await session.commit()
    return Response(status_code=204)


@router.get("/videos/{youtube_id}/segments", response_model=SegmentsPage)
async def get_segments(
    youtube_id: str,
    page: int = 1,
    page_size: int = 50,
    q: str | None = None,
    reviewed: bool | None = None,
    content_type: str | None = None,
    session: AsyncSession = Depends(get_session),
) -> SegmentsPage:
    """Return paginated segments for a video. Supports search + filter."""
    video_result = await session.execute(
        select(Video).where(Video.youtube_id == youtube_id)
    )
    video = video_result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=404, detail=f"Video {youtube_id} not found.")
    if video.status != "fetched":
        raise HTTPException(
            status_code=409,
            detail=f"Video is not ready (status={video.status}). Ingest it first.",
        )

    base_where = Segment.video_id == video.id
    filters = [base_where]

    if q:
        like = f"%{q}%"
        filters.append(
            (Segment.te_original.ilike(like))
            | (Segment.en_auto.ilike(like))
            | (Segment.en_human.ilike(like))
            | (Segment.en_final.ilike(like))
        )
    if reviewed is not None:
        filters.append(Segment.is_reviewed == reviewed)
    if content_type:
        filters.append(Segment.content_type == content_type)

    where_clause = filters[0] if len(filters) == 1 else filters[0].__and__(*filters[1:])

    total_result = await session.execute(
        select(func.count(Segment.id)).where(where_clause)
    )
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    seg_result = await session.execute(
        select(Segment)
        .where(where_clause)
        .order_by(Segment.segment_index)
        .offset(offset)
        .limit(page_size)
    )
    segments = seg_result.scalars().all()

    return SegmentsPage(
        total=total,
        page=page,
        page_size=page_size,
        total_pages=ceil(total / page_size) if total else 1,
        items=[SegmentResponse.model_validate(s) for s in segments],
    )


@router.patch("/segments/{segment_id}", response_model=SegmentResponse)
async def patch_segment(
    segment_id: int,
    body: SegmentPatch,
    session: AsyncSession = Depends(get_session),
) -> SegmentResponse:
    """Update en_human, is_reviewed, quality_score, or content_type on a segment.
    Also saves to TranslationMemory and revision history."""
    result = await session.execute(
        select(Segment).where(Segment.id == segment_id)
    )
    segment = result.scalar_one_or_none()
    if segment is None:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found.")

    old_human = segment.en_human

    if body.en_human is not None:
        segment.en_human = body.en_human
        segment.en_final = body.en_human if body.en_human.strip() else segment.en_auto
        # Save to Translation Memory
        if body.en_human.strip():
            te_clean = segment.te_original.strip()
            en_clean = body.en_human.strip()
            # Check for exact match first
            existing = await session.execute(
                select(TranslationMemory).where(
                    TranslationMemory.te_text == te_clean,
                    TranslationMemory.en_text == en_clean,
                )
            )
            tm = existing.scalar_one_or_none()
            if tm:
                tm.usage_count += 1
            else:
                session.add(TranslationMemory(
                    te_text=te_clean,
                    en_text=en_clean,
                    source_video_id=segment.video_id,
                    source_segment_id=segment.id,
                    usage_count=1,
                ))
        # Save revision
        session.add(SegmentRevision(
            segment_id=segment.id,
            en_human_before=old_human,
            en_human_after=body.en_human,
        ))

    if body.is_reviewed is not None:
        segment.is_reviewed = body.is_reviewed
    if body.quality_score is not None:
        segment.quality_score = body.quality_score
    if body.content_type is not None:
        segment.content_type = body.content_type

    await session.commit()
    await session.refresh(segment)
    return SegmentResponse.model_validate(segment)


@router.get("/tm/search", response_model=TMSearchResponse)
async def tm_search(
    q: str,
    limit: int = 5,
    session: AsyncSession = Depends(get_session),
) -> TMSearchResponse:
    """Fuzzy search Translation Memory. Returns closest matches."""
    like = f"%{q}%"
    result = await session.execute(
        select(TranslationMemory)
        .where(TranslationMemory.te_text.ilike(like))
        .order_by(TranslationMemory.usage_count.desc())
        .limit(limit * 3)
    )
    rows = result.scalars().all()

    # Simple Levenshtein-like scoring (Python's difflib)
    from difflib import SequenceMatcher

    scored = []
    for tm in rows:
        ratio = SequenceMatcher(None, q.lower(), tm.te_text.lower()).ratio()
        scored.append((ratio, tm))

    scored.sort(key=lambda x: x[0], reverse=True)

    return TMSearchResponse(
        query=q,
        results=[
            TMSearchResult(te_text=tm.te_text, en_text=tm.en_text, similarity=round(ratio, 3))
            for ratio, tm in scored[:limit]
        ],
    )
