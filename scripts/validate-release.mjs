import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readLocks, releaseTag } from "./lib/config.mjs";

export function validateReleaseTag(tag, build) {
  const expected = releaseTag(build);
  if (tag !== expected) throw new Error(`Expected release tag ${expected}, got ${tag}.`);
  return expected;
}

async function main() {
  const tag = process.argv[2] ?? process.env.GITHUB_REF_NAME;
  const { build } = await readLocks();
  validateReleaseTag(tag, build);
  const type = execFileSync("git", ["cat-file", "-t", `refs/tags/${tag}`], { encoding: "utf8" }).trim();
  if (type !== "tag") throw new Error(`${tag} must be an annotated tag.`);
  execFileSync("git", ["merge-base", "--is-ancestor", `${tag}^{}`, "origin/main"], { stdio: "inherit" });
  console.log(`Validated annotated release tag ${tag}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
