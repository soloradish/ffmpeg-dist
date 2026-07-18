import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));

export async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

export async function readLocks() {
  const [build, deps] = await Promise.all([
    readJson("build-lock.json"),
    readJson("deps-lock.json"),
  ]);
  return { build, deps };
}

export function releaseTag(build) {
  return `v${build.ffmpegVersion}-r${build.distributionRevision}`;
}

export function distributionStem(build) {
  return `ffmpeg-${build.ffmpegVersion}-r${build.distributionRevision}`;
}

export function assetFileName(build, profile, target) {
  const extension = target.archiveFormat === "zip" ? "zip" : "tar.xz";
  return `${distributionStem(build)}-${profile}-${target.id}.${extension}`;
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(await readFile(filePath));
  return hash.digest("hex");
}

export async function fileRecord(filePath, downloadUrl) {
  const info = await stat(filePath);
  return {
    fileName: path.basename(filePath),
    downloadUrl,
    sha256: await sha256File(filePath),
    size: info.size,
  };
}

export function assertSha256(value, label) {
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new Error(`${label} must be a lowercase SHA-256 digest.`);
  }
}
