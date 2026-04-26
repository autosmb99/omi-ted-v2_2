from youtube_transcript_api import YouTubeTranscriptApi

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

ytt = YouTubeTranscriptApi()

ok = 0
err = 0
for vid_id in test_ids:
    try:
        tl = ytt.list(vid_id)
        te = tl.find_generated_transcript(['te'])
        en = te.translate('en').fetch()
        n = len(list(en))
        print(f"OK  {vid_id}: {n} segments")
        ok += 1
    except Exception as e:
        print(f"ERR {vid_id}: {type(e).__name__}: {e}")
        err += 1

print(f"\n--- {ok}/{ok+err} succeeded ({100*ok/(ok+err):.0f}%) ---")
