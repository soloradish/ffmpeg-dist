# Building and releasing

The GitHub Actions workflows are the release authority. Local builds are useful for iteration but do not produce official `ffmpeg-dist` assets.

## Inputs

- `build-lock.json` pins FFmpeg, the distribution revision, profiles, and targets.
- `deps-lock.json` is the complete extended-profile dependency allowlist.
- Source downloads are accepted only after SHA-256 verification.

Install Node.js from `.nvmrc`, then validate metadata and fetch sources:

```bash
npm test
npm run validate:locks
npm run validate:workflows
node scripts/fetch-sources.mjs --output source-archives
```

## Native build entry point

Run the build only on the matching native host with the same tools installed by `_build.yml`:

```bash
bash scripts/build.sh TARGET core source-archives artifacts
bash scripts/build.sh TARGET extended source-archives artifacts
```

The script extracts into `.work/`, builds locked dependencies from source, builds FFmpeg out of tree, runs native capability and linkage tests, writes `BUILD-INFO.json`, and creates the release archive. It refuses unknown targets or profiles.

Linux builds require `musl-gcc`; Windows builds run inside the configured UCRT64 MSYS2 shell; macOS builds use the native Xcode/Clang toolchain with deployment target 11.0.

## Release procedure

1. Change locks or scripts in a pull request.
2. Require `CI / Gate` to pass, including all five native targets.
3. Merge to `main`.
4. Create an annotated tag matching the lock, for example `git tag -a v8.1.2-r1 -m "ffmpeg-dist v8.1.2-r1"`.
5. Push only that tag. The Release workflow rebuilds every asset from the tagged commit.

The workflow creates ten binary archives, one corresponding-source bundle, the v1 manifest, and checksums; it attests all thirteen files before uploading them to a draft Release and publishing it. If inputs must change after a failure, prepare a new revision rather than moving a published tag.

Repository administrators apply `.github/main-branch-protection.json` to `main`, `.github/release-tag-ruleset.json` as the release-tag ruleset, and enable the immutable-releases repository setting. These checked-in policies document the required GitHub-side configuration; changing them requires the same review as changing a release workflow.
