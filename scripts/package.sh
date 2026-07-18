#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?target is required}"
stage="${2:?stage directory is required}"
artifact_dir="${3:?artifact directory is required}"
stage_parent="$(dirname "$stage")"
stage_name="$(basename "$stage")"
mkdir -p "$artifact_dir"

if [[ "$target" == windows-* ]]; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$(cygpath -w "$root/scripts/package-windows.ps1")" \
    -Stage "$(cygpath -w "$stage")" \
    -Destination "$(cygpath -w "$artifact_dir/$stage_name.zip")"
else
  tar -cJf "$artifact_dir/$stage_name.tar.xz" -C "$stage_parent" "$stage_name"
fi
