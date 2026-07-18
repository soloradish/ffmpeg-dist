import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readLocks, releaseTag } from "./lib/config.mjs";

function required(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Missing ${name}.`);
  return process.argv[index + 1];
}

const targetId = required("--target");
const profileId = required("--profile");
const output = path.resolve(required("--output"));
const configureArgsFile = path.resolve(required("--configure-args"));
const { build, deps } = await readLocks();
const target = build.targets.find((candidate) => candidate.id === targetId);
const profile = build.profiles[profileId];
if (!target || !profile) throw new Error("Unknown target or profile.");

const info = {
  schemaVersion: 1,
  releaseTag: releaseTag(build),
  ffmpegVersion: build.ffmpegVersion,
  distributionRevision: build.distributionRevision,
  profile: profileId,
  target: targetId,
  platform: target.platform,
  architecture: target.architecture,
  libc: target.libc,
  license: profile.license,
  source: build.source,
  dependencies: profileId === "extended" ? deps.dependencies : [],
  configureArgs: (await readFile(configureArgsFile, "utf8")).split(/\r?\n/).filter(Boolean),
  toolchain: {
    compiler: process.env.FFMPEG_DIST_COMPILER ?? "unknown",
    runnerImage: process.env.ImageOS ?? null,
    runnerImageVersion: process.env.ImageVersion ?? null,
  },
  provenance: {
    repository: process.env.GITHUB_REPOSITORY ?? null,
    commit: process.env.GITHUB_SHA ?? null,
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
  },
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(info, null, 2)}\n`, "utf8");
