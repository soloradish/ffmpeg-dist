import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertSha256, assetFileName, distributionStem, fileRecord, readLocks, releaseTag } from "./lib/config.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

export async function createManifest(directory, repository, build) {
  const tag = releaseTag(build);
  const baseUrl = `https://github.com/${repository}/releases/download/${tag}`;
  const sourceName = `${distributionStem(build)}-sources.tar.xz`;
  const sourcePath = path.join(directory, sourceName);
  await access(sourcePath);

  const assets = [];
  for (const profile of Object.keys(build.profiles)) {
    for (const target of build.targets) {
      const fileName = assetFileName(build, profile, target);
      const filePath = path.join(directory, fileName);
      await access(filePath);
      assets.push({
        profile,
        target: target.id,
        platform: target.platform,
        architecture: target.architecture,
        libc: target.libc,
        license: build.profiles[profile].license,
        archiveFormat: target.archiveFormat,
        executables: target.platform === "windows" ? ["ffmpeg.exe", "ffprobe.exe"] : ["ffmpeg", "ffprobe"],
        ...(await fileRecord(filePath, `${baseUrl}/${fileName}`)),
      });
    }
  }
  const manifest = {
    schemaVersion: 1,
    releaseTag: tag,
    ffmpegVersion: build.ffmpegVersion,
    distributionRevision: build.distributionRevision,
    source: await fileRecord(sourcePath, `${baseUrl}/${sourceName}`),
    assets,
  };
  validateManifest(manifest, build);
  return manifest;
}

export function validateManifest(manifest, build) {
  if (manifest.schemaVersion !== 1) throw new Error("Manifest schemaVersion must be 1.");
  if (manifest.releaseTag !== releaseTag(build)) throw new Error("Manifest releaseTag does not match the build lock.");
  if (manifest.ffmpegVersion !== build.ffmpegVersion) throw new Error("Manifest FFmpeg version mismatch.");
  if (manifest.distributionRevision !== build.distributionRevision) throw new Error("Manifest revision mismatch.");
  assertSha256(manifest.source.sha256, "Manifest source hash");
  if (!Number.isInteger(manifest.source.size) || manifest.source.size < 1) throw new Error("Invalid source size.");

  const expected = new Set();
  for (const profile of Object.keys(build.profiles)) {
    for (const target of build.targets) expected.add(`${profile}:${target.id}`);
  }
  if (manifest.assets.length !== expected.size) throw new Error(`Manifest must contain exactly ${expected.size} assets.`);
  const seen = new Set();
  for (const asset of manifest.assets) {
    const key = `${asset.profile}:${asset.target}`;
    if (!expected.has(key)) throw new Error(`Unexpected manifest asset ${key}.`);
    if (seen.has(key)) throw new Error(`Duplicate manifest asset ${key}.`);
    seen.add(key);
    assertSha256(asset.sha256, `${key} hash`);
    if (!Number.isInteger(asset.size) || asset.size < 1) throw new Error(`Invalid size for ${key}.`);
    if (!asset.downloadUrl.endsWith(`/${asset.fileName}`)) throw new Error(`Download URL mismatch for ${key}.`);
  }
  return manifest;
}

async function main() {
  const directory = path.resolve(argument("--directory", "release-assets"));
  const repository = argument("--repository", process.env.GITHUB_REPOSITORY ?? "soloradish/ffmpeg-dist");
  const output = path.resolve(argument("--output", path.join(directory, "ffmpeg-dist-manifest-v1.json")));
  const { build } = await readLocks();
  const manifest = await createManifest(directory, repository, build);
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`Wrote ${output} with ${manifest.assets.length} binary assets.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
