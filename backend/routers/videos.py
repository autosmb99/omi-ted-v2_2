"""
Video and segment endpoints.

GET    /api/v1/videos                       — list all videos
GET    /api/v1/videos/{youtube_id}/segments — paginated segments for one video
DELETE /api/v1/videos/{youtube_id}          — delete a video and all segments
PATCH  /api/v1/segments/{segment_id}        — save human translation + review flag
"""
from __future__ import annotations

from math import ceil

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Job, Segment, Video

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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/videos", response_model=list[VideoSummary])
async def list_videos(
    session: AsyncSession = Depends(get_session),
) -> list[VideoSummary]:
    """Return all videos with segment counts and latest job error_msg."""
    # Correlated subquery: latest error_msg from jobs for each video
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
    session: AsyncSession = Depends(get_session),
) -> SegmentsPage:
    """Return paginated segments for a video."""
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

    total_result = await session.execute(
        select(func.count(Segment.id)).where(Segment.video_id == video.id)
    )
    total = total_result.scalar_one()

    offset = (page - 1) * page_size
    seg_result = await session.execute(
        select(Segment)
        .where(Segment.video_id == video.id)
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
    """Update en_human, is_reviewed, or quality_score on a segment."""
    result = await session.execute(
        select(Segment).where(Segment.id == segment_id)
    )
    segment = result.scalar_one_or_none()
    if segment is None:
        raise HTTPException(status_code=404, detail=f"Segment {segment_id} not found.")

    if body.en_human is not None:
        segment.en_human = body.en_human
        segment.en_final = body.en_human if body.en_human.strip() else segment.en_auto
    if body.is_reviewed is not None:
        segment.is_reviewed = body.is_reviewed
    if body.quality_score is not None:
        segment.quality_score = body.quality_score

    await session.commit()
    await session.refresh(segment)
    return SegmentResponse.model_validate(segment)
