"""
Transcript fetch service — pure I/O, no DB.

Fetches Telugu auto-captions (+ English if available) for a YouTube video
using yt-dlp + a cookies.txt file, then parses subtitle data into segments.

Cookie file: $YTDLP_COOKIES_FILE env variable (required at runtime).
"""
from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass, field
from functools import partial

import httpx
import yt_dlp

_YDL_OPTS: dict = {
    "skip_download": True,
    "quiet": True,
    "no_warnings": True,
    "ignore_no_formats_error": True,
}


@dataclass
class SegmentData:
    start_time: float
    duration: float
    te_original: str
    en_auto: str | None = None


@dataclass
class VideoData:
    title: str | None
    channel: str | None
    duration_s: int | None
    segments: list[SegmentData] = field(default_factory=list)
    has_te: bool = False


def get_cookies_file() -> str:
    path = os.environ.get("YTDLP_COOKIES_FILE", "").strip()
    if not path:
        raise RuntimeError(
            "YTDLP_COOKIES_FILE is not set. Export cookies.txt from your browser "
            "and set: $env:YTDLP_COOKIES_FILE='C:\\path\\to\\cookies.txt'"
        )
    if not os.path.exists(path):
        raise RuntimeError(f"Cookies file not found: {path}")
    return path


def _pick_json3(formats: list[dict]) -> str | None:
    for fmt in formats:
        if fmt.get("ext") == "json3":
            return fmt.get("url")
    return formats[0].get("url") if formats else None


def _parse_json3(data: dict) -> list[dict]:
    segments: list[dict] = []
    for event in data.get("events", []):
        segs = event.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8", "") for s in segs).strip()
        if not text or text == "\n":
            continue
        segments.append({
            "start_time": event.get("tStartMs", 0) / 1000.0,
            "duration":   event.get("dDurationMs", 0) / 1000.0,
            "text":       text,
        })
    return segments


def _load_cookies(cookies_file: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    try:
        with open(cookies_file) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("\t")
                if len(parts) >= 7:
                    cookies[parts[5]] = parts[6]
    except Exception:
        pass
    return cookies


async def _download_subtitle(
    url: str,
    cookies_file: str | None = None,
    required: bool = True,
) -> list[dict]:
    """
    Fetch subtitle URL (json3) with browser-style headers + cookies.
    required=True  -> raises on error (Telugu: we need it)
    required=False -> returns [] on error (English: M5 fills it via LLM)
    """
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.youtube.com/",
    }
    cookies = _load_cookies(cookies_file) if cookies_file else {}
    try:
        async with httpx.AsyncClient(
            timeout=30, follow_redirects=True, headers=headers, cookies=cookies
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        return _parse_json3(resp.json())
    except Exception:
        if required:
            raise
        return []


def _ydl_extract(youtube_id: str, cookies_file: str) -> dict:
    url = f"https://www.youtube.com/watch?v={youtube_id}"
    opts = {**_YDL_OPTS, "cookiefile": cookies_file}
    with yt_dlp.YoutubeDL(opts) as ydl:
        return ydl.extract_info(url, download=False) or {}


async def fetch_video(youtube_id: str) -> VideoData:
    """
    Fetch metadata + Telugu (+ English if available) auto-captions for one video.
    Raises RuntimeError / yt_dlp.DownloadError on failure.
    """
    cookies_file = get_cookies_file()

    loop = asyncio.get_running_loop()
    info = await loop.run_in_executor(
        None, partial(_ydl_extract, youtube_id, cookies_file)
    )

    if not info:
        raise ValueError(f"yt-dlp returned empty info for {youtube_id}")

    title      = info.get("title")
    channel    = info.get("uploader") or info.get("channel")
    duration_s = info.get("duration")

    auto_caps   = info.get("automatic_captions") or {}
    manual_subs = info.get("subtitles") or {}

    te_formats = auto_caps.get("te") or manual_subs.get("te") or []
    en_formats = auto_caps.get("en") or manual_subs.get("en") or []

    if not te_formats:
        return VideoData(
            title=title, channel=channel, duration_s=duration_s,
            segments=[], has_te=False,
        )

    te_url = _pick_json3(te_formats)
    en_url = _pick_json3(en_formats)

    # Telugu is required; English is optional (silent fail)
    te_raw = await _download_subtitle(te_url, cookies_file, required=True)

    en_raw: list[dict] = []
    if en_url:
        en_raw = await _download_subtitle(en_url, cookies_file, required=False)

    en_by_start: dict[float, str] = {s["start_time"]: s["text"] for s in en_raw}

    def _closest_en(start: float) -> str | None:
        if start in en_by_start:
            return en_by_start[start]
        for k, v in en_by_start.items():
            if abs(k - start) <= 0.05:
                return v
        return None

    segments = [
        SegmentData(
            start_time=s["start_time"],
            duration=s["duration"],
            te_original=s["text"],
            en_auto=_closest_en(s["start_time"]),
        )
        for s in te_raw
    ]

    return VideoData(
        title=title,
        channel=channel,
        duration_s=duration_s,
        segments=segments,
        has_te=True,
    )
