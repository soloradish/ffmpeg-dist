import { assertSha256, assetFileName, readLocks, releaseTag } from "./lib/config.mjs";
import { pathToFileURL } from "node:url";

export function validateLocks(build, deps) {
  if (build.schemaVersion !== 1 || deps.schemaVersion !== 1) {
    throw new Error("Unsupported lock schema version.");
  }
  if (!/^\d+\.\d+\.\d+$/.test(build.ffmpegVersion)) {
    throw new Error("ffmpegVersion must be a stable MAJOR.MINOR.PATCH version.");
  }
  if (!Number.isInteger(build.distributionRevision) || build.distributionRevision < 1) {
    throw new Error("distributionRevision must be a positive integer.");
  }
  assertSha256(build.source.sha256, "FFmpeg source hash");
  if (build.source.archiveName !== `ffmpeg-${build.ffmpegVersion}.tar.xz`) {
    throw new Error("FFmpeg source archive name does not match ffmpegVersion.");
  }

  const expectedTargets = new Set([
    "windows-x86_64",
    "macos-aarch64",
    "macos-x86_64",
    "linux-x86_64-musl",
    "linux-aarch64-musl",
  ]);
  const targetIds = new Set(build.targets.map((target) => target.id));
  if (targetIds.size !== build.targets.length || targetIds.size !== expectedTargets.size) {
    throw new Error("Target IDs must be unique and contain exactly the v1 target matrix.");
  }
  for (const target of expectedTargets) {
    if (!targetIds.has(target)) throw new Error(`Missing target ${target}.`);
  }

  const expectedDeps = ["mbedtls", "lame", "libogg", "libvorbis", "libopus", "libvpx"];
  const dependencyIds = deps.dependencies.map((dependency) => dependency.id);
  if (new Set(dependencyIds).size !== dependencyIds.length) {
    throw new Error("Dependency IDs must be unique.");
  }
  if (dependencyIds.join(",") !== expectedDeps.join(",")) {
    throw new Error(`Extended dependencies must be exactly: ${expectedDeps.join(", ")}.`);
  }
  for (const dependency of deps.dependencies) {
    assertSha256(dependency.sha256, `${dependency.id} hash`);
    if (!dependency.url.startsWith("https://")) throw new Error(`${dependency.id} must use HTTPS.`);
  }

  const profiles = Object.keys(build.profiles);
  if (profiles.join(",") !== "core,extended") {
    throw new Error("Profiles must be exactly core and extended.");
  }
  if (build.profiles.core.network || build.profiles.core.externalDependencies.length !== 0) {
    throw new Error("Core must disable networking and external dependencies.");
  }
  if (build.profiles.extended.externalDependencies.join(",") !== expectedDeps.join(",")) {
    throw new Error("Extended dependency list must match deps-lock.json.");
  }

  for (const profile of profiles) {
    for (const target of build.targets) assetFileName(build, profile, target);
  }
  return releaseTag(build);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { build, deps } = await readLocks();
  console.log(`Validated ${validateLocks(build, deps)} locks.`);
}
