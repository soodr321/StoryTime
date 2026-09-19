#!/bin/zsh
# Stable URL on GitHub Pages: https://soodr321.github.io/StoryTime/
set -e
cd "$(dirname "$0")/.."
for d in library/*/; do s=$(basename "$d"); [ -f "public/library/$s/p1.m4a" ] || { echo "missing narration for $s → generating"; npm run audio >/dev/null || exit 1; break; }; done
python3 - <<'GUARD' || exit 1
import json, sys
from pathlib import Path
m = json.loads(Path("public/sounds/manifest.json").read_text())
pack = m.get("_pack")
if pack and not pack.get("redistributable", True):
    sys.exit(f"refusing to deploy: the letter sounds come from {pack['name']!r} ({pack['license']}).\n"
             f"Run `npm run sounds:build commons` (or `family`) before deploying.")
GUARD
npx vitest run >/dev/null || { echo "tests failed; not deploying"; exit 1; }
BASE_PATH=/StoryTime/ npm run build >/dev/null
cp vercel.json dist/ 2>/dev/null || true
touch dist/.nojekyll
TMP=$(mktemp -d)
git -C "$TMP" init -q -b gh-pages
cp -R dist/. "$TMP"/
git -C "$TMP" add -A
git -C "$TMP" -c user.name="Rishabh Sood" -c user.email="soodr321@gmail.com" commit -q -m "deploy $(date -u +%Y-%m-%dT%H:%MZ)"
git -C "$TMP" push -q -f "$(git remote get-url origin)" gh-pages:gh-pages
rm -rf "$TMP"
echo "pushed gh-pages"
