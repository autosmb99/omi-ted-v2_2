"""
Dataset export endpoints.

GET /api/v1/export/jsonl?youtube_id={id}   — JSONL fine-tune dataset
GET /api/v1/export/csv?youtube_id={id}     — CSV with all fields

Only exports segments where en_final is not null.
"""
from __future__ import annotations

import csv
import io
import json

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Segment, Video

router = APIRouter(tags=["export"])


async def _get_video_or_404(youtube_id: str, session: AsyncSession) -> Video:
    result = await session.execute(
        select(Video).where(Video.youtube_id == youtube_id)
    )
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=404, detail=f"Video {youtube_id} not found.")
    return video


@router.get("/export/jsonl")
async def export_jsonl(
    youtube_id: str = Query(..., description="YouTube video ID"),
    reviewed_only: bool = Query(False, description="Only export reviewed segments"),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """
    Download a JSONL fine-tuning dataset for one video.

    Each line is:
      {"te": "...", "en": "...", "source": "youtube_id", "t": 12.34}

    en = en_human if set, else en_auto.
    """
    video = await _get_video_or_404(youtube_id, session)

    query = select(Segment).where(
        Segment.video_id == video.id,
        Segment.en_final.isnot(None),
    ).order_by(Segment.segment_index)

    if reviewed_only:
        query = query.where(Segment.is_reviewed == True)  # noqa: E712

    result = await session.execute(query)
    segments = result.scalars().all()

    def _generate():
        for seg in segments:
            yield json.dumps({
                "te": seg.te_original,
                "en": seg.en_final,
                "source": youtube_id,
                "t": round(seg.start_time, 2),
            }, ensure_ascii=False) + "\n"

    filename = f"{youtube_id}{'_reviewed' if reviewed_only else ''}.jsonl"
    return StreamingResponse(
        _generate(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/csv")
async def export_csv(
    youtube_id: str = Query(..., description="YouTube video ID"),
    reviewed_only: bool = Query(False, description="Only export reviewed segments"),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Download a CSV export with all segment fields."""
    video = await _get_video_or_404(youtube_id, session)

    query = select(Segment).where(
        Segment.video_id == video.id,
        Segment.en_final.isnot(None),
    ).order_by(Segment.segment_index)

    if reviewed_only:
        query = query.where(Segment.is_reviewed == True)  # noqa: E712

    result = await session.execute(query)
    segments = result.scalars().all()

    def _generate():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "segment_index", "start_time", "duration",
            "te_original", "en_auto", "en_human", "en_final",
            "content_type", "is_reviewed", "quality_score",
        ])
        yield buf.getvalue()

        for seg in segments:
            buf = io.StringIO()
            writer = csv.writer(buf)
            writer.writerow([
                seg.segment_index, round(seg.start_time, 3), round(seg.duration, 3),
                seg.te_original, seg.en_auto or "", seg.en_human or "", seg.en_final or "",
                seg.content_type, seg.is_reviewed, seg.quality_score or "",
            ])
            yield buf.getvalue()

    filename = f"{youtube_id}{'_reviewed' if reviewed_only else ''}.csv"
    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
