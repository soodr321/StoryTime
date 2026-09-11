#!/bin/zsh
# Stable URL on GitHub Pages: https://soodr321.github.io/StoryTime/
set -e
cd "$(dirname "$0")/.."
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
