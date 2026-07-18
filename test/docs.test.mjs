import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { root } from "../scripts/lib/config.mjs";

const markdownFiles = [
  "README.md",
  "README.zh-CN.md",
  "AGENTS.md",
  "docs/INTEGRATION.md",
  "docs/INTEGRATION.zh-CN.md",
  "docs/BUILDING.md",
];

test("documentation keeps the unofficial-distribution and agent contract visible", async () => {
  const english = await readFile(path.join(root, "README.md"), "utf8");
  const chinese = await readFile(path.join(root, "README.zh-CN.md"), "utf8");
  assert.match(english, /independent, unofficial build and distribution of FFmpeg/);
  assert.match(english, /For AI coding agents/);
  assert.match(chinese, /独立维护的非官方 FFmpeg 构建与分发/);
  assert.match(chinese, /给 AI coding agent/);
  assert.match(english, /docs\/INTEGRATION\.md/);
  assert.match(chinese, /docs\/INTEGRATION\.zh-CN\.md/);
});

test("local Markdown links resolve", async () => {
  for (const relativeFile of markdownFiles) {
    const sourcePath = path.join(root, relativeFile);
    const content = await readFile(sourcePath, "utf8");
    for (const match of content.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)) {
      const target = match[1].split("#", 1)[0];
      await assert.doesNotReject(access(path.resolve(path.dirname(sourcePath), target)), `${relativeFile}: ${target}`);
    }
  }
});
