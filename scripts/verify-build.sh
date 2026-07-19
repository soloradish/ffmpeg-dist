#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?target is required}"
profile="${2:?profile is required}"
stage="${3:?stage directory is required}"
version="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(lock.ffmpegVersion)' "$root/build-lock.json")"
exe_suffix=""
[[ "$target" == windows-* ]] && exe_suffix=".exe"
ffmpeg="$stage/bin/ffmpeg$exe_suffix"
ffprobe="$stage/bin/ffprobe$exe_suffix"

on_error() {
  local status=$?
  {
    printf 'Verification failed.\n'
    printf 'target=%s profile=%s exit=%s line=%s\n' "$target" "$profile" "$status" "${BASH_LINENO[0]:-unknown}"
    printf 'command=%s\n' "${BASH_COMMAND:-unknown}"
  } | tee "$stage/VERIFY-FAILURE.txt" >&2
  exit "$status"
}
trap on_error ERR

test -x "$ffmpeg" || { echo "Missing executable: $ffmpeg" >&2; exit 1; }
test -x "$ffprobe" || { echo "Missing executable: $ffprobe" >&2; exit 1; }
"$ffmpeg" -version | tr -d '\r' | head -n 1 | grep -E "ffmpeg version n?$version([[:space:]]|$)" || { echo "Unexpected ffmpeg version." >&2; exit 1; }
"$ffprobe" -version | tr -d '\r' | head -n 1 | grep -E "ffprobe version n?$version([[:space:]]|$)" || { echo "Unexpected ffprobe version." >&2; exit 1; }
buildconf="$($ffmpeg -buildconf 2>&1 | tr -d '\r')"
if grep -Eq -- '--enable-(gpl|nonfree)' <<<"$buildconf"; then
  echo "Forbidden GPL or nonfree build flag detected." >&2
  exit 1
fi

protocols="$($ffmpeg -hide_banner -protocols 2>&1 | tr -d '\r')"
if [[ "$profile" == "core" ]]; then
  grep -q -- '--disable-network' <<<"$buildconf" || { echo "Core is missing --disable-network." >&2; exit 1; }
  grep -q -- '--disable-version3' <<<"$buildconf" || { echo "Core is missing --disable-version3." >&2; exit 1; }
  if grep -Eq '^[[:space:]]*https?$' <<<"$protocols"; then
    echo "Core unexpectedly exposes HTTP(S)." >&2
    exit 1
  fi
else
  for flag in --enable-version3 --enable-mbedtls --enable-libmp3lame --enable-libopus --enable-libvorbis --enable-libvpx; do
    grep -q -- "$flag" <<<"$buildconf" || { echo "Missing extended flag $flag" >&2; exit 1; }
  done
  # The local TLS round trip below is the authoritative HTTPS capability test.
  # It is stronger and less formatting-sensitive than parsing `ffmpeg -protocols`.
  encoders="$($ffmpeg -hide_banner -encoders 2>&1 | tr -d '\r')"
  for encoder in libmp3lame libopus libvorbis libvpx libvpx-vp9; do
    grep -q "$encoder" <<<"$encoders" || { echo "Missing encoder $encoder" >&2; exit 1; }
  done
fi

demuxers="$($ffmpeg -hide_banner -demuxers 2>&1 | tr -d '\r')"
decoders="$($ffmpeg -hide_banner -decoders 2>&1 | tr -d '\r')"
for demuxer in mov matroska mp3 aac wav flac ogg; do
  grep -q "$demuxer" <<<"$demuxers" || { echo "Missing demuxer $demuxer" >&2; exit 1; }
done
for decoder in aac mp3 flac vorbis opus pcm_s16le; do
  grep -q "$decoder" <<<"$decoders" || { echo "Missing decoder $decoder" >&2; exit 1; }
done

fixtures="$root/.work/verify-$target-$profile"
case "$fixtures" in
  "$root/.work/"*) rm -rf "$fixtures" ;;
  *) exit 1 ;;
esac
mkdir -p "$fixtures"
node "$root/scripts/generate-fixtures.mjs" "$fixtures"
"$ffmpeg" -v error -i "$fixtures/tone.wav" -map 0:a:0 -vn -ac 1 -ar 16000 -f s16le "$fixtures/tone.pcm"
test -s "$fixtures/tone.pcm"

if [[ "$profile" == "extended" ]]; then
  "$ffmpeg" -v error -i "$fixtures/tone.wav" -c:a libmp3lame "$fixtures/tone.mp3"
  "$ffmpeg" -v error -i "$fixtures/tone.wav" -c:a libopus "$fixtures/tone.opus"
  "$ffmpeg" -v error -i "$fixtures/tone.wav" -c:a libvorbis "$fixtures/tone.ogg"
  for encoded in "$fixtures/tone.mp3" "$fixtures/tone.opus" "$fixtures/tone.ogg"; do
    "$ffmpeg" -v error -i "$encoded" -f null -
  done
  "$ffmpeg" -v error -f rawvideo -pixel_format yuv420p -video_size 16x16 -framerate 1 -i "$fixtures/video.yuv" -frames:v 2 -c:v libvpx "$fixtures/vp8.webm"
  "$ffmpeg" -v error -f rawvideo -pixel_format yuv420p -video_size 16x16 -framerate 1 -i "$fixtures/video.yuv" -frames:v 2 -c:v libvpx-vp9 "$fixtures/vp9.webm"
  "$ffmpeg" -v error -i "$fixtures/vp8.webm" -f null -
  "$ffmpeg" -v error -i "$fixtures/vp9.webm" -f null -

  # MSYS2 rewrites slash-prefixed arguments when invoking Windows programs.
  # Exclude only the OpenSSL subject: key and certificate paths still need
  # normal MSYS2-to-Windows conversion.
  if [[ "$target" == windows-* ]]; then
    MSYS2_ARG_CONV_EXCL='/CN=localhost' openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=localhost' -keyout "$fixtures/key.pem" -out "$fixtures/cert.pem"
  else
    openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj '/CN=localhost' -keyout "$fixtures/key.pem" -out "$fixtures/cert.pem"
  fi
  node "$root/scripts/https-server.mjs" "$fixtures" "$fixtures/cert.pem" "$fixtures/key.pem" 18443 >"$fixtures/server.log" 2>&1 &
  server_pid=$!
  trap 'kill "$server_pid" 2>/dev/null || true' EXIT
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    grep -q READY "$fixtures/server.log" && break
    sleep 1
  done
  grep -q READY "$fixtures/server.log"
  "$ffmpeg" -v error -tls_verify 0 -i https://127.0.0.1:18443/tone.wav -f null -
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  trap - EXIT
fi

case "$target" in
  linux-*)
    grep -q -- '--cc=musl-gcc' <<<"$buildconf"
    grep -q -- '--cxx=musl-gcc' <<<"$buildconf"
    file "$ffmpeg" | grep -Eqi 'statically linked|static-pie linked'
    if ldd "$ffmpeg" >"$fixtures/ldd.txt" 2>&1; then
      echo "Linux binary is unexpectedly dynamically linked." >&2
      cat "$fixtures/ldd.txt" >&2
      exit 1
    fi
    ;;
  macos-*)
    expected_arch="${target#macos-}"
    [[ "$expected_arch" == "aarch64" ]] && expected_arch="arm64"
    file "$ffmpeg" | grep -q "$expected_arch"
    unexpected="$(otool -L "$ffmpeg" | tail -n +2 | grep -vE '^[[:space:]]+(/usr/lib/|/System/Library/)' || true)"
    test -z "$unexpected" || { echo "Unexpected macOS libraries:$unexpected" >&2; exit 1; }
    ;;
  windows-*)
    file "$ffmpeg" | grep -Eqi 'PE32\+.*x86-64'
    unexpected="$(objdump -p "$ffmpeg" | sed -n 's/^[[:space:]]*DLL Name: //p' | grep -Ei '^(libgcc|libstdc\+\+|libwinpthread)' || true)"
    test -z "$unexpected" || { echo "Unexpected Windows runtime DLLs:$unexpected" >&2; exit 1; }
    ;;
esac

test -f "$stage/BUILD-INFO.json"
test -f "$stage/LICENSES/FFmpeg-LICENSE.md"
trap - ERR
echo "Verified $profile for $target."
