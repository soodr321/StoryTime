#!/bin/zsh
# Production deploy to Vercel: https://storytime-coral.vercel.app (project "storytime", linked under dist/.vercel)
set -e
cd "$(dirname "$0")/.."
npx vitest run >/dev/null || { echo "tests failed; not deploying"; exit 1; }
npm run build >/dev/null
cp vercel.json dist/
npx -y vercel@latest link --cwd dist --project storytime --yes >/dev/null
npx -y vercel@latest deploy dist --prod --yes
