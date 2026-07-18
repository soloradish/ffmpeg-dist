#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:?target is required}"
profile="${2:?profile is required}"
archives="${3:-$root/source-archives}"
artifact_dir="${4:-$root/artifacts}"

case "$profile" in
  core|extended) ;;
  *) echo "Unsupported profile: $profile" >&2; exit 1 ;;
esac

version="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(lock.ffmpegVersion)' "$root/build-lock.json")"
revision="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(String(lock.distributionRevision))' "$root/build-lock.json")"
work="$root/.work/build-$target-$profile"
sources="$work/sources"
prefix="$work/prefix"
build_root="$work/build"
stage_name="ffmpeg-$version-r$revision-$profile-$target"
stage="$work/package/$stage_name"
configure_args_file="$work/ffmpeg-configure-args.txt"

case "$work" in
  "$root/.work/"*) rm -rf "$work" ;;
  *) echo "Refusing to clean unexpected work path: $work" >&2; exit 1 ;;
esac
mkdir -p "$sources" "$prefix" "$build_root" "$stage/bin" "$stage/LICENSES" "$artifact_dir"

jobs=2
if command -v nproc >/dev/null 2>&1; then
  jobs="$(nproc)"
elif command -v sysctl >/dev/null 2>&1; then
  jobs="$(sysctl -n hw.logicalcpu)"
elif [[ -n "${NUMBER_OF_PROCESSORS:-}" ]]; then
  jobs="$NUMBER_OF_PROCESSORS"
fi

extract_archive() {
  local name="$1"
  test -f "$archives/$name" || { echo "Missing source archive: $name" >&2; exit 1; }
  tar -xf "$archives/$name" -C "$sources"
}

source_directory() {
  local pattern="$1"
  local found=""
  for candidate in "$sources"/$pattern; do
    if [[ -d "$candidate" ]]; then
      found="$candidate"
      break
    fi
  done
  test -n "$found" || { echo "Unable to find extracted source matching $pattern" >&2; exit 1; }
  printf '%s' "$found"
}

extract_archive "ffmpeg-$version.tar.xz"
ffmpeg_source="$(source_directory "ffmpeg-$version")"

cc=cc
cxx=c++
ffmpeg_cxx=c++
ar=ar
ranlib=ranlib
strip_tool=strip
host_arg=""
ffmpeg_target_args=()
vpx_target=""
extra_cflags=""
extra_ldflags=""
extra_libs=""

case "$target" in
  windows-x86_64)
    cc=gcc
    cxx=g++
    ffmpeg_cxx=g++
    host_arg="--host=x86_64-w64-mingw32"
    ffmpeg_target_args=(--target-os=mingw32 --arch=x86_64)
    vpx_target=x86_64-win64-gcc
    extra_cflags="-D_WIN32_WINNT=0x0A00"
    extra_ldflags="-static -static-libgcc"
    # Mbed TLS links these Windows system libraries, but its generated
    # pkg-config files do not expose them for static consumers.
    extra_libs="-lws2_32 -lbcrypt"
    ;;
  macos-aarch64)
    cc=clang
    cxx=clang++
    ffmpeg_cxx=clang++
    ffmpeg_target_args=(--target-os=darwin --arch=aarch64)
    vpx_target=arm64-darwin24-gcc
    export MACOSX_DEPLOYMENT_TARGET="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(lock.macosMinimumVersion)' "$root/build-lock.json")"
    ;;
  macos-x86_64)
    cc=clang
    cxx=clang++
    ffmpeg_cxx=clang++
    ffmpeg_target_args=(--target-os=darwin --arch=x86_64)
    vpx_target=x86_64-darwin24-gcc
    export MACOSX_DEPLOYMENT_TARGET="$(node -e 'const lock=require(process.argv[1]); process.stdout.write(lock.macosMinimumVersion)' "$root/build-lock.json")"
    ;;
  linux-x86_64-musl)
    cc=musl-gcc
    # libvpx also produces an auxiliary C++ rate-control archive. FFmpeg only
    # links libvpx.a, whose objects are still compiled with musl-gcc.
    cxx=g++
    ffmpeg_cxx=musl-gcc
    ffmpeg_target_args=(--target-os=linux --arch=x86_64)
    vpx_target=x86_64-linux-gcc
    extra_ldflags="-static"
    ;;
  linux-aarch64-musl)
    cc=musl-gcc
    # See the linux-x86_64-musl note above. The final FFmpeg binaries never
    # link the auxiliary C++ archive and are verified as fully static.
    cxx=g++
    ffmpeg_cxx=musl-gcc
    ffmpeg_target_args=(--target-os=linux --arch=aarch64)
    vpx_target=arm64-linux-gcc
    extra_ldflags="-static"
    ;;
  *) echo "Unsupported target: $target" >&2; exit 1 ;;
esac

export CC="$cc" CXX="$cxx" AR="$ar" RANLIB="$ranlib"
export PKG_CONFIG_PATH="$prefix/lib/pkgconfig:$prefix/share/pkgconfig"
export PKG_CONFIG_LIBDIR="$PKG_CONFIG_PATH"

build_autotools() {
  local source_path="$1"
  shift
  pushd "$source_path" >/dev/null
  if [[ -n "$host_arg" ]]; then
    ./configure --prefix="$prefix" "$host_arg" --disable-shared --enable-static "$@"
  else
    ./configure --prefix="$prefix" --disable-shared --enable-static "$@"
  fi
  make -j"$jobs"
  make install
  popd >/dev/null
}

build_vorbis() {
  local source_path="$1"
  pushd "$source_path" >/dev/null
  if [[ -n "$host_arg" ]]; then
    ./configure --prefix="$prefix" "$host_arg" --disable-shared --enable-static \
      --with-ogg="$prefix" --disable-examples --disable-docs
  else
    ./configure --prefix="$prefix" --disable-shared --enable-static \
      --with-ogg="$prefix" --disable-examples --disable-docs
  fi

  # The upstream aggregate target also links test_sharedbook with a legacy
  # Apple linker flag. Build only the libraries consumed by FFmpeg; the
  # extended-profile verification performs an actual Vorbis round trip.
  make -C lib -j"$jobs" libvorbis.la libvorbisfile.la libvorbisenc.la
  make -C include/vorbis install-vorbisincludeHEADERS
  make -C lib install-libLTLIBRARIES
  make install-pkgconfigDATA
  popd >/dev/null
}

if [[ "$profile" == "extended" ]]; then
  extract_archive "mbedtls-3.6.7.tar.bz2"
  extract_archive "lame-3.100.tar.gz"
  extract_archive "libogg-1.3.6.tar.xz"
  extract_archive "libvorbis-1.3.7.tar.xz"
  extract_archive "opus-1.5.2.tar.gz"
  extract_archive "libvpx-1.16.0.tar.gz"

  mbedtls_source="$(source_directory "mbedtls-3.6.7")"
  lame_source="$(source_directory "lame-3.100")"
  ogg_source="$(source_directory "libogg-1.3.6")"
  vorbis_source="$(source_directory "libvorbis-1.3.7")"
  opus_source="$(source_directory "opus-1.5.2")"
  vpx_source="$(source_directory "libvpx-1.16.0")"

  cmake -S "$mbedtls_source" -B "$build_root/mbedtls" -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DCMAKE_INSTALL_PREFIX="$prefix" \
    -DCMAKE_INSTALL_LIBDIR=lib \
    -DCMAKE_C_COMPILER="$cc" \
    -DENABLE_PROGRAMS=OFF \
    -DENABLE_TESTING=OFF \
    -DUSE_SHARED_MBEDTLS_LIBRARY=OFF \
    -DUSE_STATIC_MBEDTLS_LIBRARY=ON
  cmake --build "$build_root/mbedtls" --parallel "$jobs"
  cmake --install "$build_root/mbedtls"

  build_autotools "$lame_source" --disable-frontend --disable-decoder
  build_autotools "$ogg_source"
  build_vorbis "$vorbis_source"
  build_autotools "$opus_source" --disable-doc --disable-extra-programs

  mkdir -p "$build_root/libvpx"
  pushd "$build_root/libvpx" >/dev/null
  CC="$cc" CXX="$cxx" "$vpx_source/configure" \
    --prefix="$prefix" \
    --target="$vpx_target" \
    --disable-shared \
    --enable-static \
    --enable-pic \
    --enable-vp8 \
    --enable-vp9 \
    --disable-examples \
    --disable-tools \
    --disable-docs \
    --disable-unit-tests
  make -j"$jobs"
  make install
  popd >/dev/null
fi

configure_args=(
  --prefix="$prefix"
  --cc="$cc"
  --cxx="$ffmpeg_cxx"
  --ar="$ar"
  --ranlib="$ranlib"
  --strip="$strip_tool"
  --disable-debug
  --disable-doc
  --disable-ffplay
  --enable-ffmpeg
  --enable-ffprobe
  --disable-devices
  --disable-autodetect
  --disable-gpl
  --disable-nonfree
  --disable-shared
  --enable-static
  --enable-pic
  --pkg-config-flags=--static
  "${ffmpeg_target_args[@]}"
)

if [[ "$profile" == "core" ]]; then
  configure_args+=(--disable-network --disable-version3)
else
  configure_args+=(
    --enable-network
    --enable-version3
    --enable-mbedtls
    --enable-libmp3lame
    --enable-libvorbis
    --enable-libopus
    --enable-libvpx
    "--extra-cflags=-I$prefix/include $extra_cflags"
    "--extra-ldflags=-L$prefix/lib $extra_ldflags"
  )
fi
if [[ "$profile" == "core" && -n "$extra_cflags" ]]; then
  configure_args+=("--extra-cflags=$extra_cflags")
fi
if [[ "$profile" == "core" && -n "$extra_ldflags" ]]; then
  configure_args+=("--extra-ldflags=$extra_ldflags")
fi
if [[ "$profile" == "extended" && -n "$extra_libs" ]]; then
  configure_args+=("--extra-libs=$extra_libs")
fi

printf '%s\n' "${configure_args[@]}" > "$configure_args_file"
mkdir -p "$build_root/ffmpeg"
pushd "$build_root/ffmpeg" >/dev/null
"$ffmpeg_source/configure" "${configure_args[@]}"
if [[ "$target" == windows-* ]]; then
  make -j"$jobs" ffmpeg.exe ffprobe.exe
else
  make -j"$jobs" ffmpeg ffprobe
fi
popd >/dev/null

exe_suffix=""
[[ "$target" == windows-* ]] && exe_suffix=".exe"
cp "$build_root/ffmpeg/ffmpeg$exe_suffix" "$stage/bin/ffmpeg$exe_suffix"
cp "$build_root/ffmpeg/ffprobe$exe_suffix" "$stage/bin/ffprobe$exe_suffix"
"$strip_tool" "$stage/bin/ffmpeg$exe_suffix" "$stage/bin/ffprobe$exe_suffix" || true
chmod 755 "$stage/bin/ffmpeg$exe_suffix" "$stage/bin/ffprobe$exe_suffix"

cp "$ffmpeg_source/LICENSE.md" "$stage/LICENSES/FFmpeg-LICENSE.md"
cp "$ffmpeg_source/COPYING.LGPLv2.1" "$stage/LICENSES/FFmpeg-COPYING.LGPLv2.1"
cp "$ffmpeg_source/COPYING.LGPLv3" "$stage/LICENSES/FFmpeg-COPYING.LGPLv3"
if [[ "$profile" == "extended" ]]; then
  cp "$mbedtls_source/LICENSE" "$stage/LICENSES/Mbed-TLS-LICENSE"
  cp "$lame_source/COPYING" "$stage/LICENSES/LAME-COPYING"
  cp "$ogg_source/COPYING" "$stage/LICENSES/libogg-COPYING"
  cp "$vorbis_source/COPYING" "$stage/LICENSES/libvorbis-COPYING"
  cp "$opus_source/COPYING" "$stage/LICENSES/libopus-COPYING"
  cp "$vpx_source/LICENSE" "$stage/LICENSES/libvpx-LICENSE"
  cp "$vpx_source/PATENTS" "$stage/LICENSES/libvpx-PATENTS"
  for third_party_license in "$vpx_source"/third_party/*/LICENSE; do
    test -f "$third_party_license" || continue
    component="$(basename "$(dirname "$third_party_license")")"
    cp "$third_party_license" "$stage/LICENSES/libvpx-third-party-$component-LICENSE"
  done
fi

export FFMPEG_DIST_COMPILER="$($cc --version | head -n 1)"
node "$root/scripts/write-build-info.mjs" \
  --target "$target" \
  --profile "$profile" \
  --configure-args "$configure_args_file" \
  --output "$stage/BUILD-INFO.json"

"$root/scripts/verify-build.sh" "$target" "$profile" "$stage"
"$root/scripts/package.sh" "$target" "$stage" "$artifact_dir"
