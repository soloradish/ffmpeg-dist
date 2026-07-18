import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assetFileName, distributionStem, readLocks } from "../scripts/lib/config.mjs";
import { createManifest, validateManifest } from "../scripts/generate-manifest.mjs";
import { validateReleaseTag } from "../scripts/validate-release.mjs";

test("release tag must exactly match the lock", async () => {
  const { build } = await readLocks();
  assert.equal(validateReleaseTag("v8.1.2-r1", build), "v8.1.2-r1");
  assert.throws(() => validateReleaseTag("v8.1.2-r2", build), /Expected release tag/);
  assert.throws(() => validateReleaseTag("v8.1.3-r1", build), /Expected release tag/);
});

test("manifest enumerates exactly two profiles across five targets", async () => {
  const { build } = await readLocks();
  const directory = await mkdtemp(path.join(os.tmpdir(), "ffmpeg-dist-manifest-"));
  await writeFile(path.join(directory, `${distributionStem(build)}-sources.tar.xz`), "source");
  for (const profile of Object.keys(build.profiles)) {
    for (const target of build.targets) {
      await writeFile(path.join(directory, assetFileName(build, profile, target)), `${profile}:${target.id}`);
    }
  }
  const manifest = await createManifest(directory, "soloradish/ffmpeg-dist", build);
  assert.equal(manifest.assets.length, 10);
  assert.equal(new Set(manifest.assets.map((asset) => `${asset.profile}:${asset.target}`)).size, 10);
  assert.match(manifest.source.downloadUrl, /v8\.1\.2-r1/);

  const duplicate = structuredClone(manifest);
  duplicate.assets[1] = structuredClone(duplicate.assets[0]);
  assert.throws(() => validateManifest(duplicate, build), /Duplicate/);
});
