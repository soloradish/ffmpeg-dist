#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
tag="${1:?release tag is required}"
assets="${2:-$root/release-assets}"
notes="${3:-$root/.work/RELEASE_NOTES.md}"

existing=""
if existing="$(gh release view "$tag" --json isDraft --jq '.isDraft' 2>/dev/null)"; then
  if [[ "$existing" != "true" ]]; then
    echo "Published release $tag already exists." >&2
    exit 1
  fi
  gh release delete "$tag" --yes
fi

gh release create "$tag" --draft --verify-tag --title "ffmpeg-dist $tag" --notes-file "$notes"
gh release upload "$tag" "$assets"/*
gh release edit "$tag" --draft=false
echo "Published immutable-ready release $tag."
