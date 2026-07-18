# AGENTS.md

## Purpose and authority

These rules apply to the entire `ffmpeg-dist` repository. This repository publishes independent, unofficial FFmpeg command-line distributions. Never describe its output as an official FFmpeg release or imply endorsement by the FFmpeg project.

`build-lock.json` and `deps-lock.json` are the source and dependency authorities. Generated Release metadata must derive from them; do not duplicate editable versions, URLs, or hashes elsewhere in code.

## Build invariants

- Preserve exactly the five v1 targets and the `core`/`extended` profile names unless a task explicitly changes the public manifest contract.
- Core must keep networking, devices, external auto-detection, GPL, nonfree, and version3 disabled.
- Extended may use only Mbed TLS, LAME, libogg, libvorbis, libopus, and libvpx. Adding or replacing a dependency requires an explicit license/security review and a revision bump.
- Never enable x264, x265, FDK-AAC, GPL, or nonfree components as an incidental build fix.
- Build all dependency libraries from the exact locked sources; do not link runner-installed codec/TLS libraries.
- Linux deliverables must remain fully static musl binaries. macOS may link only Apple system libraries. Windows may link only Windows system DLLs.
- Packages expose CLI executables only: `ffmpeg`, `ffprobe`, `LICENSES/`, and `BUILD-INFO.json`.

## Workflow and release rules

- External Actions must be pinned to full 40-character commit SHAs.
- Pull requests and manual CI validate but never publish. Only an annotated `v{version}-r{revision}` tag reachable from `main` can publish.
- Keep write, OIDC, and attestation permissions isolated to the final publish job.
- Create releases as drafts, upload all verified assets, then publish. Never replace an asset, move a published tag, or reuse a released version/revision.
- A source or script correction after publication requires a new `rN`.
- Do not weaken checksum, native execution, license-flag, codec, TLS, architecture, or dynamic-linkage checks to make CI pass.

## Consumer contract

Agents integrating this repository elsewhere must follow `docs/INTEGRATION.md`: commit exact tag/asset/hash records, verify before extraction, validate profile and architecture, package licenses, retain the exact corresponding-source link, and run native package smoke tests. `latest` URLs and unverified downloads are forbidden.

## Required checks

| Change | Required verification |
| --- | --- |
| Documentation only | Check English/Chinese parity, links, examples, and unofficial-distribution wording |
| Locks, manifest, or Node tooling | `npm test`, `npm run validate:locks`, `npm run validate:workflows` |
| Build/profile/dependency changes | All metadata checks plus core and extended builds on all five native targets |
| Workflow or release behavior | Full CI matrix and a non-publishing workflow-dispatch run before tagging |
| Consumer-facing package contract | Manifest tests plus an integration test in the affected consumer repository |

Downloaded sources, `.work/`, `artifacts/`, and `release-assets/` are generated and must not be committed.
