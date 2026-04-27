"""Fine-tuning dashboard stats. GET /api/v1/stats"""
from __future__ import annotations
import re
from collections import Counter, defaultdict
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_session
from models import Segment

router = APIRouter(tags=["stats"])
CHARS_PER_TOKEN = 3.5
TOP_TERMS = 30
_PUNCT = re.compile(r"[^ఀ-౿a-zA-Z0-9]+")

def _words(text: str) -> list[str]:
    return [w for w in _PUNCT.split(text.strip()) if len(w) >= 2]

class TermTranslation(BaseModel):
    translation: str
    count: int

class TopTerm(BaseModel):
    word: str
    occurrences: int
    translations: list[TermTranslation]
    consistent: bool

class DatasetStats(BaseModel):
    total_segments: int
    gold_segments: int
    silver_segments: int
    empty_segments: int
    est_tokens_gold: int
    est_tokens_silver: int
    gold_pct: float
    silver_pct: float
    top_terms: list[TopTerm]

@router.get("/stats", response_model=DatasetStats)
async def get_stats(session: AsyncSession = Depends(get_session)) -> DatasetStats:
    has_human = Segment.en_human.isnot(None)
    has_final = Segment.en_final.isnot(None)
    no_human  = Segment.en_human.is_(None)
    is_silver = has_final & no_human

    res = await session.execute(
        select(
            func.count(Segment.id).label("total"),
            func.sum(case((has_human, 1), else_=0)).label("gold"),
            func.sum(case((is_silver, 1), else_=0)).label("silver"),
            func.sum(case(
                (has_human, func.length(Segment.te_original) + func.length(Segment.en_human)),
                else_=0,
            )).label("gold_chars"),
            func.sum(case(
                (is_silver, func.length(Segment.te_original) + func.length(Segment.en_final)),
                else_=0,
            )).label("silver_chars"),
        )
    )
    row = res.one()
    total  = int(row.total  or 0)
    gold   = int(row.gold   or 0)
    silver = int(row.silver or 0)
    empty  = max(0, total - gold - silver)
    est_gold   = int((row.gold_chars   or 0) / CHARS_PER_TOKEN)
    est_silver = int((row.silver_chars or 0) / CHARS_PER_TOKEN)
    gold_pct   = round(gold   / total * 100, 1) if total else 0.0
    silver_pct = round(silver / total * 100, 1) if total else 0.0

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

    top_terms = []
    for word, occ in word_freq.most_common(TOP_TERMS):
        tc: Counter = Counter(word_trans[word])
        top_terms.append(TopTerm(
            word=word,
            occurrences=occ,
            translations=[TermTranslation(translation=t, count=c) for t, c in tc.most_common(5)],
            consistent=(len(tc) <= 1),
        ))

    return DatasetStats(
        total_segments=total,
        gold_segments=gold,
        silver_segments=silver,
        empty_segments=empty,
        est_tokens_gold=est_gold,
        est_tokens_silver=est_silver,
        gold_pct=gold_pct,
        silver_pct=silver_pct,
        top_terms=top_terms,
    )
