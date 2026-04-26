r"""
Fallback validator: tries multiple cookie sources until one works, then runs
the full 20-video Telugu auto-caption check.

Cookie source order (first one that works wins):
  1. $env:YTDLP_COOKIES_FILE  (path to a cookies.txt — exported from any browser
                               with the "Get cookies.txt LOCALLY" extension)
  2. Edge       (default on Windows, no App-Bound Encryption issue)
  3. Firefox    (only if installed)
  4. Chromium   (only if installed)
  5. Chrome     (often fails on Windows due to App-Bound Encryption — yt-dlp #7271)
  6. Brave

Override the order with $env:YTDLP_COOKIES_BROWSER='firefox' to force one.

Privacy: cookies stay on your machine. cookies.txt is gitignored.

Usage:
    pip install yt-dlp
    python scripts/validate_transcripts_ytdlp.py
"""
import os
import sys
import yt_dlp

COOKIES_FILE = os.environ.get("YTDLP_COOKIES_FILE")
FORCED_BROWSER = os.environ.get("YTDLP_COOKIES_BROWSER")

test_ids = [
    "byo17c-RPQM",
    "v9eAr7zeEhg",
    "RZFcwVvXllU",
    "qffQo0GG4hs",
    "alD7vZ_zLNU",
    "D6LtoX0WfOs",
    "r1gT8gN7oqc",
    "XB9FkzykHu8",
    "dCBcGzK8OTA",
    "EypFktwYN7c",
    "37y7kaWA6Hg",
    "U7oZL0B0Hjc",
    "FIYmvcSjnKY",
    "9-UV_qoswEU",
    "yf_TUkj3mfY",
    "rjvGNkD_PPM",
    "LfF-vKZ7_Ms",
    "2iobJEzR6qk",
    "6MBdq6TGhus",
    "riWObCFzZqI",
]

BASE_OPTS = {
    "skip_download": True,
    "writesubtitles": False,
    "writeautomaticsub": False,
    "quiet": True,
    "no_warnings": True,
    "extract_flat": False,
}

PROBE_ID = test_ids[0]
PROBE_URL = f"https://www.youtube.com/watch?v={PROBE_ID}"


def candidate_sources():
    """Yield (label, opts_extension) tuples in priority order."""
    if COOKIES_FILE:
        yield (f"file: {COOKIES_FILE}", {"cookiefile": COOKIES_FILE})
        return
    if FORCED_BROWSER:
        yield (f"browser: {FORCED_BROWSER}",
               {"cookiesfrombrowser": (FORCED_BROWSER,)})
        return
    for browser in ("edge", "firefox", "chromium", "chrome", "brave"):
        yield (f"browser: {browser}",
               {"cookiesfrombrowser": (browser,)})


def probe(opts):
    """Try to fetch one video. Return (ok, message)."""
    try:
        with yt_dlp.YoutubeDL({**BASE_OPTS, **opts}) as ydl:
            info = ydl.extract_info(PROBE_URL, download=False)
        if not info:
            return False, "no info returned"
        return True, "ok"
    except Exception as e:
        msg = str(e)
        if len(msg) > 250:
            msg = msg[:250] + "..."
        return False, f"{type(e).__name__}: {msg}"


# Find a working cookie source
print("--- probing cookie sources ---")
working_opts = None
working_label = None
for label, ext in candidate_sources():
    print(f"  trying {label}...", end=" ", flush=True)
    ok, msg = probe(ext)
    if ok:
        print("OK")
        working_opts = ext
        working_label = label
        break
    print(f"FAIL ({msg})")

if working_opts is None:
    print("\nNo cookie source worked. Manual fallback:")
    print("  1. Install Chrome extension: 'Get cookies.txt LOCALLY'")
    print("  2. Visit youtube.com signed in, click extension, Export")
    print(r"  3. Save to C:\Users\kawin\Projects\omi-ted-v2\cookies.txt")
    print(r"  4. Run: $env:YTDLP_COOKIES_FILE='C:\Users\kawin\Projects\omi-ted-v2\cookies.txt'")
    print( "         python scripts/validate_transcripts_ytdlp.py")
    sys.exit(1)

print(f"\n--- using {working_label} for full run ---\n")

opts = {**BASE_OPTS, **working_opts}
ok = 0
err = 0
for vid_id in test_ids:
    url = f"https://www.youtube.com/watch?v={vid_id}"
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
        auto = (info or {}).get("automatic_captions", {}) or {}
        manual = (info or {}).get("subtitles", {}) or {}
        te_auto = auto.get("te")
        te_manual = manual.get("te")
        if te_auto or te_manual:
            kind = "manual" if te_manual else "auto"
            entries = te_manual or te_auto
            print(f"OK  {vid_id}: te {kind} ({len(entries)} format entries)")
            ok += 1
        else:
            langs = sorted(set(list(auto.keys()) + list(manual.keys())))[:8]
            print(f"ERR {vid_id}: no 'te' captions; langs (first 8): {langs}")
            err += 1
    except Exception as e:
        msg = str(e)
        if len(msg) > 200:
            msg = msg[:200] + "..."
        print(f"ERR {vid_id}: {type(e).__name__}: {msg}")
        err += 1

total = ok + err
pct = 100 * ok / total if total else 0
print(f"\n--- {ok}/{total} succeeded ({pct:.0f}%) ---")
print(f"--- cookie source used: {working_label} ---")
