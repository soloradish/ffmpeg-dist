# Consumer integration contract

This document is the normative integration procedure for humans and AI coding agents consuming `soloradish/ffmpeg-dist`.

## 1. Select, then pin

Choose `core` unless the application explicitly requires HTTPS input or one of the extended external encoders. Map the host to one supported target:

| Host | Target |
| --- | --- |
| Windows x64 | `windows-x86_64` |
| macOS `arm64` | `macos-aarch64` |
| macOS `x86_64` | `macos-x86_64` |
| Linux `x86_64` | `linux-x86_64-musl` |
| Linux `aarch64`/`arm64` | `linux-aarch64-musl` |

Read the manifest from an exact Release tag. Copy the selected record into the consumer repository instead of fetching the manifest on every build:

```json
{
  "repository": "soloradish/ffmpeg-dist",
  "releaseTag": "v8.1.2-r1",
  "ffmpegVersion": "8.1.2",
  "profile": "core",
  "target": "windows-x86_64",
  "assetName": "ffmpeg-8.1.2-r1-core-windows-x86_64.zip",
  "url": "https://github.com/soloradish/ffmpeg-dist/releases/download/v8.1.2-r1/ffmpeg-8.1.2-r1-core-windows-x86_64.zip",
  "sha256": "COPY_FROM_THE_RELEASE_MANIFEST"
}
```

One lock record is required for each target the consumer ships. The placeholder above must never be committed.

## 2. Prepare the application resource

The preparation script must:

1. Download only the locked URL.
2. Compute SHA-256 from the downloaded bytes and reject any mismatch before extraction.
3. Extract the single top-level package directory.
4. Locate `bin/ffmpeg[.exe]` and, when needed, `bin/ffprobe[.exe]` by their fixed paths rather than by recursive first-match search.
5. Check that `BUILD-INFO.json` matches the locked version, profile, target, and source hash.
6. Run `ffmpeg -version` and `ffmpeg -buildconf`; reject unexpected versions, GPL/nonfree flags, or a profile mismatch.
7. Copy the executable and the complete `LICENSES/` directory into the application's packaged resources.

Cache keys must include the complete consumer lock file. A cache hit is never a substitute for the checksum and executable checks.

## 3. Preserve compliance metadata

The application's third-party notice must name FFmpeg, state the profile license, link the exact `ffmpeg-dist` Release and its source bundle, and explain that `ffmpeg-dist` is an unofficial distribution. If the application exposes a download page, place the corresponding-source link close to the application download.

Do not describe these binaries as official FFmpeg releases.

## 4. Verify the consumer

At minimum, CI must run on every architecture the application ships and verify:

- the resource executable starts and reports the locked FFmpeg version;
- the real application command line succeeds on a fixture;
- the production package contains the executable and licenses;
- the installed application can start the bundled executable;
- no development or test fallback silently selects a system FFmpeg for the official package.

For Sylloop, use core and run its mono 16 kHz `s16le` analysis pipeline plus Windows and both macOS package smoke tests.

## 5. Upgrade through a dedicated pull request

An upgrade PR must contain the new exact tag, asset records, hashes, notices, and any changed preparation logic. Review the producer's lock diff and `BUILD-INFO.json`, then run the complete native package matrix. Never move an existing consumer lock to a replacement asset under the same tag; published corrections use a new `rN`.

## Agent completion checklist

Before declaring an integration complete, an agent must be able to point to:

- committed target-specific lock records with real SHA-256 values;
- checksum verification before extraction;
- explicit profile and architecture validation;
- packaged third-party licenses and exact source link;
- native package/smoke-test evidence for every supported target.
