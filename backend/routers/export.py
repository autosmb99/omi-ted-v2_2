"""
Dataset export endpoints.

GET /api/v1/export/jsonl?youtube_id={id}&reviewed_only=false&format=raw&split=none
GET /api/v1/export/csv?youtube_id={id}&reviewed_only=false

format options (JSONL only):
  raw     (default) {"te": "...", "en": "...", "source": "...", "t": 12.34}
  alpaca  {"instruction": "...", "input": "...", "output": "..."}
  openai  {"messages": [...]}

split options (JSONL only, no youtube_id required):
  none    (default) — all segments in one file
  train   — 80% random sample
  val     — 10% random sample
  test    — 10% random sample

Only exports segments where en_final is not null.
"""
from __future__ import annotations

import csv
import io
import json
import random

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Segment, Video

router = APIRouter(tags=["export"])

INSTRUCTION = "Translate this Telugu Christian sermon text to English."
SYSTEM_MSG = (
    "You are a Telugu to English translator specializing in Christian theology. "
    "Translate accurately and preserve theological terms."
)


async def _get_video_or_404(youtube_id: str, session: AsyncSession) -> Video:
    result = await session.execute(
        select(Video).where(Video.youtube_id == youtube_id)
    )
    video = result.scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=404, detail=f"Video {youtube_id} not found.")
    return video


def _format_segment(seg: Segment, youtube_id: str, fmt: str) -> dict:
    """Convert a segment to the requested fine-tune format."""
    te = seg.te_original
    en = seg.en_final or ""

    if fmt == "alpaca":
        return {
            "instruction": INSTRUCTION,
            "input": te,
            "output": en,
        }
    elif fmt == "openai":
        return {
            "messages": [
                {"role": "system", "content": SYSTEM_MSG},
                {"role": "user", "content": te},
                {"role": "assistant", "content": en},
            ]
        }
    else:
        # raw (default)
        return {
            "te": te,
            "en": en,
            "source": youtube_id,
            "t": round(seg.start_time, 2),
        }


@router.get("/export/jsonl")
async def export_jsonl(
    youtube_id: str | None = Query(None, description="YouTube video ID (omit for global export)"),
    reviewed_only: bool = Query(False, description="Only export reviewed segments"),
    format: str = Query("raw", description="Output format: raw | alpaca | openai"),
    split: str = Query("none", description="Dataset split: none | train | val | test"),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """
    Download a JSONL fine-tuning dataset.

    - Omit youtube_id to export across all videos.
    - Use split=train/val/test to get an 80/10/10 random split for ML training.
    """
    if format not in ("raw", "alpaca", "openai"):
        raise HTTPException(status_code=400, detail="format must be raw, alpaca, or openai.")
    if split not in ("none", "train", "val", "test"):
        raise HTTPException(status_code=400, detail="split must be none, train, val, or test.")

    # Build base query
    query = select(Segment).where(Segment.en_final.isnot(None))
    if reviewed_only:
        query = query.where(Segment.is_reviewed == True)  # noqa: E712

    if youtube_id:
        video = await _get_video_or_404(youtube_id, session)
        query = query.where(Segment.video_id == video.id)

    query = query.order_by(Segment.segment_index)
    result = await session.execute(query)
    segments = list(result.scalars().all())

    # Apply split
    if split != "none":
        # Deterministic shuffle with fixed seed for reproducibility
        rng = random.Random(42)
        rng.shuffle(segments)
        n = len(segments)
        if n == 0:
            train_end = val_end = 0
        else:
            train_end = int(n * 0.8)
            val_end = train_end + int(n * 0.1)
        if split == "train":
            segments = segments[:train_end]
        elif split == "val":
            segments = segments[train_end:val_end]
        elif split == "test":
            segments = segments[val_end:]

    def _generate():
        for seg in segments:
            sid = youtube_id or "global"
            yield json.dumps(
                _format_segment(seg, sid, format),
                ensure_ascii=False
            ) + "\n"

    parts = [youtube_id or "global"]
    if reviewed_only:
        parts.append("reviewed")
    if split != "none":
        parts.append(split)
    if format != "raw":
        parts.append(format)
    filename = "_".join(parts) + ".jsonl"

    return StreamingResponse(
        _generate(),
        media_type="application/x-ndjson",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/export/csv")
async def export_csv(
    youtube_id: str | None = Query(None, description="YouTube video ID (omit for global export)"),
    reviewed_only: bool = Query(False, description="Only export reviewed segments"),
    session: AsyncSession = Depends(get_session),
) -> StreamingResponse:
    """Download a CSV export with all segment fields."""
    query = select(Segment).where(Segment.en_final.isnot(None))
    if reviewed_only:
        query = query.where(Segment.is_reviewed == True)  # noqa: E712
    if youtube_id:
        video = await _get_video_or_404(youtube_id, session)
        query = query.where(Segment.video_id == video.id)
    query = query.order_by(Segment.segment_index)

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

    parts = [youtube_id or "global"]
    if reviewed_only:
        parts.append("reviewed")
    filename = "_".join(parts) + ".csv"

    return StreamingResponse(
        _generate(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
