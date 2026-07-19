import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { root } from "../scripts/lib/config.mjs";

test("publish permissions are isolated from reusable builds", async () => {
  const build = await readFile(path.join(root, ".github/workflows/_build.yml"), "utf8");
  const release = await readFile(path.join(root, ".github/workflows/release.yml"), "utf8");
  assert.doesNotMatch(build, /contents:\s+write/);
  assert.match(build, /name: diagnostics-\$\{\{ matrix\.target \}\}/);
  assert.match(release, /attestations:\s+write/);
  assert.match(release, /contents:\s+write/);
  assert.doesNotMatch(release, /workflow_dispatch/);
});
