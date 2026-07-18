#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
archives="${1:-$root/source-archives}"
output="${2:-$root/artifacts}"
version="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(lock.ffmpegVersion)' "$root/build-lock.json")"
revision="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(String(lock.distributionRevision))' "$root/build-lock.json")"
bundle_name="ffmpeg-$version-r$revision-sources"
work="$root/.work/source-bundle"
case "$work" in
  "$root/.work/"*) rm -rf "$work" ;;
  *) exit 1 ;;
esac
mkdir -p "$work/$bundle_name" "$output"
cp "$archives"/*.tar.* "$work/$bundle_name/"
node "$root/scripts/write-sources-manifest.mjs" --output "$work/$bundle_name/SOURCES.json"
cp "$root/docs/BUILDING.md" "$work/$bundle_name/BUILDING.md"
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime="@$(git -C "$root" log -1 --format=%ct 2>/dev/null || printf '0')" \
  -cJf "$output/$bundle_name.tar.xz" -C "$work" "$bundle_name"
