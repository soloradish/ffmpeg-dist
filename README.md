[简体中文](README.zh-CN.md)

# ffmpeg-dist

> [!IMPORTANT]
> **This is an independent, unofficial build and distribution of FFmpeg.** It is not affiliated with, endorsed by, sponsored by, or supported by the FFmpeg project. The official FFmpeg project, documentation, source code, and downloads are at [ffmpeg.org](https://ffmpeg.org/).

`ffmpeg-dist` produces pinned, checksummed `ffmpeg` and `ffprobe` command-line binaries for desktop applications that want to bundle FFmpeg without compiling it in every consumer repository. The first consumer is [soloradish/sylloop](https://github.com/soloradish/sylloop).

## Release matrix

Every release contains two profiles for five targets:

| Target | Runner architecture | Package |
| --- | --- | --- |
| `windows-x86_64` | Windows x64 | ZIP |
| `macos-aarch64` | Apple Silicon | TAR.XZ |
| `macos-x86_64` | Intel macOS | TAR.XZ |
| `linux-x86_64-musl` | Linux x64, static musl | TAR.XZ |
| `linux-aarch64-musl` | Linux arm64, static musl | TAR.XZ |

- **core** is the default for local-media applications. It keeps FFmpeg's built-in formats, codecs, and filters while disabling networking, devices, GPL, nonfree, version3, and external auto-detection. It is distributed under `LGPL-2.1-or-later`.
- **extended** adds HTTPS through Mbed TLS and the locked LAME, Ogg, Vorbis, Opus, and libvpx libraries. It still disables GPL and nonfree components and is distributed under `LGPL-3.0-or-later`.

Packages contain only the command-line programs and their compliance material:

```text
ffmpeg-VERSION-rREVISION-PROFILE-TARGET/
├── bin/ffmpeg[.exe]
├── bin/ffprobe[.exe]
├── LICENSES/
└── BUILD-INFO.json
```

Development headers and FFmpeg libraries are intentionally out of scope.

## Consume a release safely

1. Select an exact tag, profile, and target from `ffmpeg-dist-manifest-v1.json`.
2. Copy the tag, asset name, and SHA-256 into a lock file in the consumer repository.
3. Download the exact `/releases/download/TAG/ASSET` URL. Never resolve `latest` during a build.
4. Verify SHA-256 before extraction.
5. Verify `ffmpeg -version`, the target architecture, profile build flags, and license.
6. Bundle the executable together with the relevant `LICENSES/` files and preserve a link to this release and its source bundle.

The full deterministic procedure and lock-file example are in [Consumer integration](docs/INTEGRATION.md).

### For AI coding agents

Agents integrating this distribution into another repository must read [docs/INTEGRATION.md](docs/INTEGRATION.md) first. Treat the release manifest as discovery metadata, not a mutable dependency resolver. Commit exact asset metadata to the consumer, preserve checksum verification and notices, and validate the consumer's native package after every update.

Do not:

- download from `releases/latest` in CI;
- trust an asset without its committed SHA-256;
- silently change from core to extended;
- omit the packaged licenses or corresponding-source link;
- replace a published asset or move a published tag.

Agents maintaining this repository must also follow [AGENTS.md](AGENTS.md).

## Verify downloads

Each release publishes `SHA256SUMS.txt`, `ffmpeg-dist-manifest-v1.json`, the exact corresponding source bundle, and GitHub artifact attestations.

```bash
sha256sum --check SHA256SUMS.txt
gh attestation verify ffmpeg-8.1.2-r1-core-linux-x86_64-musl.tar.xz \
  --repo soloradish/ffmpeg-dist
```

Checksums prove file integrity. Attestations tie an artifact to this repository and workflow; neither mechanism is a claim that FFmpeg or a media file is vulnerability-free.

## Build and release policy

The source and dependency locks are [`build-lock.json`](build-lock.json) and [`deps-lock.json`](deps-lock.json). Pull requests run metadata tests and native builds for every target. A release is created only from an annotated tag matching `v{ffmpegVersion}-r{revision}` on `main`.

- An upstream FFmpeg update starts at `r1`, for example `v8.1.3-r1`.
- A build, dependency, or packaging change with the same FFmpeg source increments the revision, for example `v8.1.2-r2`.
- Published releases and tags are immutable. A corrected build receives a new revision.

See [Building](docs/BUILDING.md) for the exact workflow and local commands.

## Support and security boundary

This repository supports the build scripts, manifest contract, checksums, and reproducibility metadata that it publishes. FFmpeg behavior and upstream security issues belong to the [FFmpeg project](https://ffmpeg.org/security.html). Dependency updates must be reviewed through a lock-file pull request and rebuilt across the complete native matrix.

The binaries are unsigned. Verify their checksums and attestations before use.

## Licensing

The automation and documentation in this repository are licensed under the [MIT License](LICENSE). FFmpeg and the extended-profile dependencies remain under their own licenses; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), the license directory inside each package, and the source bundle attached to each release.
