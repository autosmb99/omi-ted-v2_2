"""
Translation service. Provider and model can be overridden per-call.
Config.yaml sets defaults; batch.py passes explicit values.
Supports: sarvam, openrouter, local (Ollama/vLLM).
Caches results in TranslationMemory to avoid duplicate API costs.
"""
from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path

import httpx
import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal
from models import TranslationMemory

logger = logging.getLogger(__name__)


def _cfg() -> dict:
    p = Path(__file__).parent.parent / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)


def _cache_key(text: str, src: str, tgt: str, provider: str) -> str:
    return hashlib.sha256(f"{text}|{src}|{tgt}|{provider}".encode()).hexdigest()[:32]


async def _lookup_cache(text: str, src: str, tgt: str, provider: str) -> str | None:
    """Return cached translation if exact match exists."""
    key = _cache_key(text, src, tgt, provider)
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(TranslationMemory).where(TranslationMemory.te_text == text)
        )
        row = result.scalar_one_or_none()
        if row:
            row.usage_count += 1
            await session.commit()
            return row.en_text
    return None


async def _save_cache(text: str, en_text: str, source_video_id: int | None = None,
                      source_segment_id: int | None = None) -> None:
    """Save a new translation to the cache."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(TranslationMemory).where(TranslationMemory.te_text == text)
        )
        existing = result.scalar_one_or_none()
        if existing:
            existing.en_text = en_text
            existing.usage_count += 1
        else:
            session.add(TranslationMemory(
                te_text=text,
                en_text=en_text,
                source_video_id=source_video_id,
                source_segment_id=source_segment_id,
            ))
        await session.commit()


async def _sarvam(text: str, src: str, tgt: str, timeout: int) -> str:
    key = os.environ.get("SARVAM_API_KEY", "")
    if not key:
        raise EnvironmentError("SARVAM_API_KEY not set. Add it in Settings.")
    lang = {"te": "te-IN", "en": "en-IN"}
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(
            "https://api.sarvam.ai/translate",
            json={"input": text, "source_language_code": lang.get(src, src),
                  "target_language_code": lang.get(tgt, tgt),
                  "speaker_gender": "Male", "mode": "formal",
                  "model": "mayura:v1", "enable_preprocessing": False},
            headers={"api-subscription-key": key, "Content-Type": "application/json"},
        )
        r.raise_for_status()
        return r.json()["translated_text"]


async def _openrouter(text: str, src: str, tgt: str, model: str, timeout: int) -> str:
    key = os.environ.get("OPENROUTER_API_KEY", "")
    if not key:
        raise EnvironmentError("OPENROUTER_API_KEY not set. Add it in Settings.")
    prompt = (
        f"Translate this Telugu Christian sermon text to English. "
        f"Preserve theological terms accurately. Output only the translation.\n\n{text}"
    )
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {key}",
                     "HTTP-Referer": "https://github.com/omi-ted",
                     "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role": "user", "content": prompt}],
                  "temperature": 0.1},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


async def _local(text: str, src: str, tgt: str, model: str, timeout: int) -> str:
    """Call a local OpenAI-compatible endpoint (Ollama, vLLM, llama.cpp server)."""
    base = os.environ.get("LOCAL_LLM_URL", "http://localhost:11434/v1")
    key = os.environ.get("LOCAL_LLM_KEY", "")
    prompt = (
        f"Translate this Telugu Christian sermon text to English. "
        f"Preserve theological terms accurately. Output only the translation.\n\n{text}"
    )
    headers = {"Content-Type": "application/json"}
    if key:
        headers["Authorization"] = f"Bearer {key}"
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(
            f"{base}/chat/completions",
            headers=headers,
            json={"model": model, "messages": [{"role": "user", "content": prompt}],
                  "temperature": 0.1},
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"].strip()


async def translate(
    text: str,
    src: str = "te",
    tgt: str = "en",
    provider: str | None = None,
    model: str | None = None,
) -> str:
    if not text or not text.strip():
        return ""
    cfg = _cfg()
    llm = cfg.get("llm", {})
    p = provider or llm.get("provider", "openrouter")
    m = model or llm.get("model", "google/gemma-3-27b-it")
    t = llm.get("timeout_s", 30)

    # Check cache first (skip for youtube provider - it doesn't call APIs)
    if p != "youtube":
        cached = await _lookup_cache(text, src, tgt, p)
        if cached is not None:
            logger.debug("Cache hit for text len=%d provider=%s", len(text), p)
            return cached

    result: str
    if p == "sarvam":
        result = await _sarvam(text, src, tgt, t)
    elif p == "openrouter":
        result = await _openrouter(text, src, tgt, m, t)
    elif p == "local":
        result = await _local(text, src, tgt, m, t)
    else:
        raise ValueError(f"Unknown provider: {p!r}")

    # Save to cache for future reuse
    await _save_cache(text, result)
    return result
