#!/usr/bin/env python3
"""
Fetch real human phoneme recordings from Wikimedia Commons (the canonical IPA sound
files, CC-licensed) and convert them into public/sounds/<grapheme>.m4a.

Why not TTS: a neural voice cannot say a bare consonant — "sss" comes out as "ess"
(measured: ~45% voiced frames). The Commons IPA set is what phonetics courses use.

  python3 scripts/fetch-phonemes.py

Writes public/sounds/manifest.json with source URL + licence per clip.
"""
import json, re, shutil, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "sounds"; OUT.mkdir(parents=True, exist_ok=True)

def ffmpeg():
    f = shutil.which("ffmpeg")
    if f: return f
    import imageio_ffmpeg; return imageio_ffmpeg.get_ffmpeg_exe()
FF = ffmpeg()

# grapheme (as taught in Letters & Sounds phase 2) -> Commons IPA recording
FILES = {
    "s": "Voiceless_alveolar_sibilant.ogg",
    "a": "Near-open_front_unrounded_vowel.ogg",      # /æ/ as in cat
    "t": "Voiceless_alveolar_plosive.ogg",
    "p": "Voiceless_bilabial_plosive.ogg",
    "i": "Near-close_near-front_unrounded_vowel.ogg", # /ɪ/ as in sit
    "n": "Alveolar_nasal.ogg",
    "m": "Bilabial_nasal.ogg",
    "d": "Voiced_alveolar_plosive.ogg",
    "g": "Voiced_velar_plosive.ogg",
    "o": "Open_back_rounded_vowel.ogg",               # /ɒ/ as in dog
    "k": "Voiceless_velar_plosive.ogg",               # also c, ck
    "e": "Open-mid_front_unrounded_vowel.ogg",        # /ɛ/ as in bed
    "u": "Open-mid_back_unrounded_vowel.ogg",         # /ʌ/ as in cup
    "r": "Alveolar_approximant.ogg",
    "h": "Voiceless_glottal_fricative.ogg",
    "b": "Voiced_bilabial_plosive.ogg",
    "f": "Voiceless_labiodental_fricative.ogg",       # also ff
    "l": "Alveolar_lateral_approximant.ogg",          # also ll
}

API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "StoryTime/0.1 (phonics app; https://github.com/soodr321/StoryTime)"}

def info(title):
    q = urllib.parse.urlencode({"action": "query", "titles": f"File:{title}", "prop": "imageinfo", "iiprop": "url|extmetadata", "format": "json"})
    with urllib.request.urlopen(urllib.request.Request(f"{API}?{q}", headers=UA)) as r:
        d = json.load(r)
    page = next(iter(d["query"]["pages"].values()))
    if "imageinfo" not in page: raise SystemExit(f"not found on Commons: {title}")
    ii = page["imageinfo"][0]; md = ii.get("extmetadata", {})
    return ii["url"], md.get("LicenseShortName", {}).get("value", "?"), re.sub("<[^>]+>", "", md.get("Artist", {}).get("value", "?")).strip()

def main():
    man = {}
    for g, title in FILES.items():
        url, lic, artist = info(title)
        raw = OUT / f"{g}.ogg"
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA)) as r, open(raw, "wb") as f: f.write(r.read())
        m4a = OUT / f"{g}.m4a"
        # trim silence, normalise loudness, cap at 1.2 s (IPA files are sometimes repeated twice)
        subprocess.run([FF, "-loglevel", "error", "-y", "-i", str(raw), "-af",
                        "silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse,atrim=0:1.2,loudnorm=I=-18:TP=-2,apad=pad_dur=0.1",
                        "-c:a", "aac", "-b:a", "96k", "-ar", "44100", "-ac", "1", str(m4a)], check=True)
        raw.unlink()
        probe = subprocess.run([FF, "-i", str(m4a)], capture_output=True, text=True).stderr
        mm = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe); ms = int((int(mm[1]) * 3600 + int(mm[2]) * 60 + float(mm[3])) * 1000)
        man[g] = {"audio": f"{g}.m4a", "ms": ms, "recorded": True, "source": f"https://commons.wikimedia.org/wiki/File:{title}", "license": lic, "artist": artist}
        print(f"  {g:2s} {ms:5d} ms  {lic:12s} {title}")
    (OUT / "manifest.json").write_text(json.dumps(man, indent=1))
    print(f"{len(man)} phoneme clips → public/sounds/ (attribution in manifest.json)")

if __name__ == "__main__": main()
