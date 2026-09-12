#!/usr/bin/env python3
"""
The "slide through the word" model, in a real voice, said slowly.

Concatenating isolated phoneme recordings does not produce a word: an ASR listener hears
"sat" as "Ssssssss", "pin" as "hehehe" and "dog" as nothing at all, because there is no
coarticulation between the segments and a looped vowel pulses. The same voice that reads the
stories, saying the word at -40%, is heard correctly ("Dog.", "Red", "Cup.") and is what a
teacher actually does when they model blending.

Individual letter sounds stay real human IPA recordings (scripts/cut-phonemes.py) — this is only
the whole-word model, played after the child has had a go.

    python3 scripts/gen-blends.py
"""
import asyncio, json, re, subprocess, sys
from pathlib import Path
try: import edge_tts
except ImportError: sys.exit("pip install edge-tts")

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "blends"; OUT.mkdir(parents=True, exist_ok=True)
VOICE, RATE = "en-US-AndrewMultilingualNeural", "-55%"   # same voice as the narration, stretched: a CVC lands around 600-900 ms

def ffmpeg():
    import shutil; f = shutil.which("ffmpeg")
    if f: return f
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
FF = ffmpeg()

def words() -> set[str]:
    out: set[str] = set()
    for d in (ROOT / "library").iterdir():
        s = json.loads((d / "story.json").read_text())
        for p in s["pages"]: out |= {w.lower() for w in (p.get("magic") or [])}
        out |= {w for w in re.findall(r"[a-z']+", s["moral"]["line"].lower())}
    teach = (ROOT / "src" / "lib" / "phonics" / "teach.ts").read_text()
    for m in re.findall(r'blend: \[([^\]]*)\]', teach):
        gs = re.findall(r'"([a-z]+)"', m)
        if gs: out.add("".join(gs))
    illtry = (ROOT / "src" / "lib" / "phonics" / "illtry.ts").read_text()
    body = illtry.split("ILL_TRY_WORDS = new Set([", 1)[1].split("]);", 1)[0]
    out |= set(re.findall(r'"([a-z]+)"', body))
    return {w for w in out if w and w.isalpha()}

async def one(word: str):
    mp3 = OUT / f"{word}.mp3"; m4a = OUT / f"{word}.m4a"
    com = edge_tts.Communicate(word, VOICE, rate=RATE)
    with open(mp3, "wb") as f:
        async for ch in com.stream():
            if ch["type"] == "audio": f.write(ch["data"])
    subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(mp3), "-af", "silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,adelay=120|120,apad=pad_dur=0.12,loudnorm=I=-17:TP=-2",   # keep a breath either side: an aggressive trim clips the opening stop
                    "-c:a", "aac", "-b:a", "64k", "-ar", "24000", "-ac", "1", str(m4a)], check=True)
    mp3.unlink()
    probe = subprocess.run([FF, "-i", str(m4a)], capture_output=True, text=True).stderr
    mm = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
    return int((int(mm[1]) * 3600 + int(mm[2]) * 60 + float(mm[3])) * 1000) if mm else 0

async def main():
    ws = sorted(words())
    print(f"{len(ws)} words → public/blends/ ({VOICE} at {RATE})")
    man = {}
    for i, w in enumerate(ws, 1):
        man[w] = await one(w)
        if i % 25 == 0 or i == len(ws): print(f"  {i}/{len(ws)}")
    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    total = sum(f.stat().st_size for f in OUT.glob("*.m4a"))
    print(f"done · {total/1024:.0f} kB total · manifest.json lists {len(man)} words")

asyncio.run(main())
