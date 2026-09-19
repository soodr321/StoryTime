#!/usr/bin/env python3
"""
Build the shipped letter sounds from whichever recorded pack is chosen.

The app plays one set of eighteen sounds. Where they come from is a swap, not a rewrite: each pack
keeps its own raw originals, goes through the same trimming, level-matching and phonetic gates, and
stamps the shipped manifest with its name, attribution and licence. A pack we may not redistribute
is built locally but refused by the deploy scripts.

    python3 scripts/build-sounds.py             # rebuild the active pack
    python3 scripts/build-sounds.py family      # switch to the family's recordings and rebuild
    python3 scripts/build-sounds.py --list
"""
import json, subprocess, sys
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / "scripts" / "sound-packs.json"
MANIFEST = ROOT / "public" / "sounds" / "manifest.json"

AUDIO = {".webm", ".m4a", ".wav", ".mp3", ".ogg"}
def takes(d: Path) -> int:
    """how many actual recordings a pack has (a README is not a recording)"""
    return len([f for f in d.glob("*") if f.suffix.lower() in AUDIO]) if d.exists() else 0

def load(): return json.loads(REG.read_text())

def main():
    reg = load(); packs = reg["packs"]
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    if "--list" in sys.argv:
        for name, p in packs.items():
            here = takes(ROOT / p["source"])
            print(f"  {'*' if name == reg['active'] else ' '} {name:10s} {p['title']:44s} {p['license']:40s} {'ready' if here else 'no recordings yet'}")
        return
    name = args[0] if args else reg["active"]
    if name not in packs: sys.exit(f"unknown pack {name!r}; try --list")
    p = packs[name]
    src = ROOT / p["source"]
    if not takes(src):
        sys.exit(f"{p['source']} has no recordings yet, so {name!r} cannot be built.\n{p.get('note', '')}".rstrip())
    print(f"building {name}: {p['title']} ({p['license']})")
    r = subprocess.run([sys.executable, str(ROOT / p["builder"])], cwd=ROOT)
    if r.returncode: sys.exit(r.returncode)
    man = json.loads(MANIFEST.read_text())
    man["_pack"] = {"name": name, "title": p["title"], "attribution": p["attribution"],
                    "license": p["license"], "redistributable": p["redistributable"],
                    "builtAt": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    MANIFEST.write_text(json.dumps(man, indent=1))
    if name != reg["active"]:
        reg["active"] = name; REG.write_text(json.dumps(reg, indent=1))
    clips = [k for k in man if not k.startswith("_")]
    print(f"{len(clips)} sounds shipped from {name}")
    if not p["redistributable"]:
        print("\n  NOT REDISTRIBUTABLE — good for reading at home, refused by the deploy scripts.\n  " + p.get("note", ""))

if __name__ == "__main__": main()
