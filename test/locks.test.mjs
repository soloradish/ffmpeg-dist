import assert from "node:assert/strict";
import test from "node:test";
import { assetFileName, readLocks, releaseTag } from "../scripts/lib/config.mjs";
import { validateLocks } from "../scripts/validate-locks.mjs";

test("v1 locks describe the exact release matrix", async () => {
  const { build, deps } = await readLocks();
  assert.equal(validateLocks(build, deps), "v8.1.2-r1");
  assert.equal(releaseTag(build), "v8.1.2-r1");
  assert.equal(build.targets.length, 5);
  assert.equal(deps.dependencies.length, 6);
  assert.equal(
    assetFileName(build, "core", build.targets[0]),
    "ffmpeg-8.1.2-r1-core-windows-x86_64.zip",
  );
});

test("lock validation rejects GPL expansion and malformed hashes", async () => {
  const { build, deps } = await readLocks();
  const badDeps = structuredClone(deps);
  badDeps.dependencies.push({
    id: "x264",
    version: "1",
    archiveName: "x264.tar.gz",
    url: "https://example.invalid/x264.tar.gz",
    sha256: "0".repeat(64),
    license: "GPL-2.0-or-later",
  });
  assert.throws(() => validateLocks(build, badDeps), /exactly/);

  const badBuild = structuredClone(build);
  badBuild.source.sha256 = "not-a-hash";
  assert.throws(() => validateLocks(badBuild, deps), /SHA-256/);
});
