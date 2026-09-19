#!/bin/zsh
# Rollback for the narrator voice (plan-voice.md G1).
#
# public/library/ and public/prompts/ are gitignored (public/blends/ and public/sounds/*.wav less
# so, but this snapshots all four together so a restore is never a partial one) — `git revert`
# restores code, never the shipped voice. Before regenerating narration with a newly-chosen voice
# (A2), snapshot what is currently deployed, so a bad pick can be rolled back without waiting on a
# second generation run.
#
#   scripts/snapshot-audio.sh                 # create a timestamped snapshot outside the repo
#   scripts/snapshot-audio.sh --list           # list snapshots, newest first
#   scripts/snapshot-audio.sh --restore latest # restore the most recent snapshot over public/
#   scripts/snapshot-audio.sh --restore <name> # restore one snapshot by name (from --list)
#
# Snapshots live outside the repo (default: ~/.storytime-audio-snapshots, override with
# STORYTIME_SNAPSHOT_DIR) so they survive `git clean`, a fresh checkout, or deleting the repo
# entirely — the whole point is that they do not depend on git.
set -e
cd "$(dirname "$0")/.."
DEST="${STORYTIME_SNAPSHOT_DIR:-$HOME/.storytime-audio-snapshots}"
mkdir -p "$DEST"

usage() { echo "usage: scripts/snapshot-audio.sh [--list | --restore <name-or-latest>]" >&2; exit 1; }

list() {
  ls -1t "$DEST"/audio-*.tar.gz 2>/dev/null | while read -r f; do
    printf "%s  %s\n" "$(basename "$f")" "$(du -h "$f" | cut -f1)"
  done
}

case "${1:-}" in
  "")
    STAMP=$(date -u +%Y%m%dT%H%M%SZ)
    ARCHIVE="$DEST/audio-$STAMP.tar.gz"
    PATHS=()
    for d in public/library public/prompts public/blends public/sounds; do
      [ -e "$d" ] && PATHS+=("$d")
    done
    if [ "${#PATHS[@]}" -eq 0 ]; then
      echo "nothing to snapshot: none of public/library, public/prompts, public/blends, public/sounds exist" >&2
      exit 1
    fi
    tar -czf "$ARCHIVE" "${PATHS[@]}"
    echo "snapshot written: $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"
    echo "restore with: scripts/snapshot-audio.sh --restore $(basename "$ARCHIVE")"
    ;;
  --list)
    list
    ;;
  --restore)
    NAME="${2:?usage: scripts/snapshot-audio.sh --restore <name-or-latest>}"
    if [ "$NAME" = "latest" ]; then
      ARCHIVE=$(ls -1t "$DEST"/audio-*.tar.gz 2>/dev/null | head -1)
      [ -n "$ARCHIVE" ] || { echo "no snapshots in $DEST" >&2; exit 1; }
    else
      ARCHIVE="$DEST/$NAME"
    fi
    [ -f "$ARCHIVE" ] || { echo "no such snapshot: $ARCHIVE" >&2; exit 1; }
    echo "restoring $ARCHIVE over public/library, public/prompts, public/blends, public/sounds"
    echo "(this OVERWRITES whatever narration/sounds are there now — snapshot first if you want to keep it)"
    read "REPLY?type 'restore' to continue: "
    [ "$REPLY" = "restore" ] || { echo "aborted"; exit 1; }
    for d in public/library public/prompts public/blends public/sounds; do
      [ -e "$d" ] && rm -rf "$d"
    done
    tar -xzf "$ARCHIVE"
    echo "restored. Bump AUDIO_V and the Workbox cacheName (G2) before deploying, so an already-"
    echo "installed phone does not keep serving the audio you just replaced from its own cache."
    ;;
  -h|--help)
    usage
    ;;
  *)
    usage
    ;;
esac
