"""
Translation service. Provider and model can be overridden per-call.
Config.yaml sets defaults; batch.py passes explicit values.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import httpx
import yaml

logger = logging.getLogger(__name__)

def _cfg() -> dict:
    p = Path(__file__).parent.parent / "config.yaml"
    with open(p) as f:
        return yaml.safe_load(f)

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

    if p == "sarvam":
        return await _sarvam(text, src, tgt, t)
    elif p == "openrouter":
        return await _openrouter(text, src, tgt, m, t)
    else:
        raise ValueError(f"Unknown provider: {p!r}")
