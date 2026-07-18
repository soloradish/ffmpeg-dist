import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { root } from "./lib/config.mjs";

const workflowDirectory = path.join(root, ".github", "workflows");
const names = (await readdir(workflowDirectory)).filter((name) => name.endsWith(".yml"));
if (names.sort().join(",") !== "_build.yml,ci.yml,release.yml") {
  throw new Error("Expected exactly _build.yml, ci.yml, and release.yml workflows.");
}

const contents = [];
for (const name of names) {
  const content = await readFile(path.join(workflowDirectory, name), "utf8");
  contents.push(content);
  for (const match of content.matchAll(/uses:\s+([^\s@]+)@([^\s#]+)/g)) {
    const [, action, reference] = match;
    if (!/^[a-f0-9]{40}$/.test(reference)) {
      throw new Error(`${name}: ${action} must be pinned to a full commit SHA, got ${reference}.`);
    }
  }
}

const combined = contents.join("\n");
for (const target of [
  "windows-x86_64",
  "macos-aarch64",
  "macos-x86_64",
  "linux-x86_64-musl",
  "linux-aarch64-musl",
]) {
  if (!combined.includes(target)) throw new Error(`Workflow matrix is missing ${target}.`);
}
if (!combined.includes('tags:\n      - "v*-r*"')) throw new Error("Release tag trigger is missing.");
if (/pull_request_target/.test(combined)) throw new Error("pull_request_target is forbidden.");
console.log(`Validated ${names.length} workflows and immutable action references.`);
