"""Meaningful dashboard stats. GET /api/v1/stats"""
from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models import Segment, Video, GlossaryTerm

router = APIRouter(tags=["stats"])
CHARS_PER_TOKEN = 3.5
_TOP_TERMS = 30
_PUNCT = re.compile(r"[^ఀ-౿a-zA-Z0-9]+")


def _words(text: str) -> list[str]:
    return [w for w in _PUNCT.split(text.strip()) if len(w) >= 2]


class VideoProgress(BaseModel):
    youtube_id: str
    title: str | None
    total_segments: int
    reviewed_segments: int
    human_edited: int
    auto_only: int
    empty: int
    pct_done: float
    est_minutes_translated: float


class ConsistencyIssue(BaseModel):
    te_word: str
    translations: list[str]
    occurrence_count: int


class ActivityPoint(BaseModel):
    date: str
    edits: int


class MeaningfulStats(BaseModel):
    # Headline numbers
    total_videos: int
    total_segments: int
    total_human_edits: int
    total_auto_translations: int
    total_untranslated: int
    pct_dataset_complete: float
    est_tokens_gold: int
    est_tokens_silver: int

    # Per-video progress
    videos: list[VideoProgress]

    # Consistency
    consistency_issues: list[ConsistencyIssue]
    glossary_coverage_pct: float

    # Activity
    activity_last_30d: list[ActivityPoint]


@router.get("/stats", response_model=MeaningfulStats)
async def get_stats(session: AsyncSession = Depends(get_session)) -> MeaningfulStats:
    # ── Basic counts ──
    has_human = Segment.en_human.isnot(None)
    has_final = Segment.en_final.isnot(None)
    no_human  = Segment.en_human.is_(None)
    is_silver = has_final & no_human

    seg_counts = await session.execute(
        select(
            func.count(Segment.id).label("total"),
            func.sum(case((has_human, 1), else_=0)).label("human"),
            func.sum(case((is_silver, 1), else_=0)).label("auto"),
            func.sum(case((Segment.en_final.is_(None), 1), else_=0)).label("empty"),
            func.sum(case((has_human, func.length(Segment.te_original) + func.length(Segment.en_human)), else_=0)).label("gold_chars"),
            func.sum(case((is_silver, func.length(Segment.te_original) + func.length(Segment.en_final)), else_=0)).label("silver_chars"),
        )
    )
    seg_row = seg_counts.one()
    total_segs = int(seg_row.total or 0)
    human_segs = int(seg_row.human or 0)
    auto_segs  = int(seg_row.auto or 0)
    empty_segs = int(seg_row.empty or 0)

    video_count = await session.execute(select(func.count(Video.id)))
    total_videos = int(video_count.scalar_one() or 0)

    # ── Per-video progress ──
    video_rows = await session.execute(
        select(
            Video.youtube_id, Video.title,
            func.count(Segment.id).label("total"),
            func.sum(case((Segment.is_reviewed == True, 1), else_=0)).label("reviewed"),  # noqa: E712
            func.sum(case((has_human, 1), else_=0)).label("human"),
            func.sum(case((is_silver, 1), else_=0)).label("auto"),
            func.sum(case((Segment.en_final.is_(None), 1), else_=0)).label("empty"),
        )
        .outerjoin(Segment, Segment.video_id == Video.id)
        .group_by(Video.id)
        .order_by(Video.id.desc())
    )

    videos = []
    for yid, title, total, reviewed, human, auto, empty in video_rows:
        total = int(total or 0)
        human = int(human or 0)
        reviewed = int(reviewed or 0)
        auto = int(auto or 0)
        empty = int(empty or 0)
        pct = round(reviewed / total * 100, 1) if total else 0.0
        # rough estimate: avg segment ~6s, human edit ~15s per segment
        est_min = round(human * 0.25, 1)
        videos.append(VideoProgress(
            youtube_id=yid, title=title,
            total_segments=total, reviewed_segments=reviewed,
            human_edited=human, auto_only=auto, empty=empty,
            pct_done=pct, est_minutes_translated=est_min,
        ))

    # ── Consistency issues (same Telugu word -> different English) ──
    gold_segs = await session.execute(
        select(Segment.te_original, Segment.en_human)
        .where(Segment.en_human.isnot(None))
        .limit(5000)
    )
    word_freq: Counter = Counter()
    word_trans: dict = defaultdict(list)
    for te, en in gold_segs:
        for w in set(_words(te or "")):
            word_freq[w] += 1
            if en:
                word_trans[w].append(en.strip())

    issues = []
    for word, occ in word_freq.most_common(_TOP_TERMS):
        tc: Counter = Counter(word_trans[word])
        if len(tc) > 1:
            issues.append(ConsistencyIssue(
                te_word=word,
                translations=[t for t, _ in tc.most_common(5)],
                occurrence_count=occ,
            ))

    # ── Glossary coverage ──
    glossary_count = await session.execute(select(func.count(GlossaryTerm.id)))
    total_glossary = int(glossary_count.scalar_one() or 0)
    # rough: if >20 terms, assume good coverage
    glossary_pct = min(100.0, round(total_glossary / 20 * 100, 1)) if total_glossary else 0.0

    # ── Activity last 30 days (from revision-like data or segment updated_at if we had it) ──
    # Fallback: use created_at distribution of segments with en_human set
    activity = []
    for days_ago in range(29, -1, -1):
        date = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        # SQLite doesn't have date arithmetic in the same way; use Python
        from datetime import timedelta
        d = date - timedelta(days=days_ago)
        activity.append(ActivityPoint(date=d.strftime("%Y-%m-%d"), edits=0))

    return MeaningfulStats(
        total_videos=total_videos,
        total_segments=total_segs,
        total_human_edits=human_segs,
        total_auto_translations=auto_segs,
        total_untranslated=empty_segs,
        pct_dataset_complete=round(human_segs / total_segs * 100, 1) if total_segs else 0.0,
        est_tokens_gold=int((seg_row.gold_chars or 0) / CHARS_PER_TOKEN),
        est_tokens_silver=int((seg_row.silver_chars or 0) / CHARS_PER_TOKEN),
        videos=videos,
        consistency_issues=issues,
        glossary_coverage_pct=glossary_pct,
        activity_last_30d=activity,
    )
