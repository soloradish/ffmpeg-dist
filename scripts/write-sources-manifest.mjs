import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readLocks, releaseTag } from "./lib/config.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const output = path.resolve(argument("--output", "source-archives/SOURCES.json"));
const { build, deps } = await readLocks();
const manifest = {
  schemaVersion: 1,
  releaseTag: releaseTag(build),
  ffmpegVersion: build.ffmpegVersion,
  sources: [
    {
      id: "ffmpeg",
      version: build.ffmpegVersion,
      archiveName: build.source.archiveName,
      url: build.source.url,
      sha256: build.source.sha256,
      license: "LGPL-2.1-or-later",
    },
    ...deps.dependencies,
  ],
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${output}.`);
