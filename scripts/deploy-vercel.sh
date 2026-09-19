#!/bin/zsh
# Production deploy to Vercel: https://storytime-coral.vercel.app (project "storytime", linked under dist/.vercel)
set -e
cd "$(dirname "$0")/.."
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
npm run build >/dev/null
cp vercel.json dist/
npx -y vercel@latest link --cwd dist --project storytime --yes >/dev/null
npx -y vercel@latest deploy dist --prod --yes
