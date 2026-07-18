import { createWriteStream } from "node:fs";
import { access, mkdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { readLocks, sha256File } from "./lib/config.mjs";
import { validateLocks } from "./validate-locks.mjs";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function download(source, outputDirectory) {
  const destination = path.join(outputDirectory, source.archiveName);
  if (await exists(destination)) {
    const current = await sha256File(destination);
    if (current === source.sha256) {
      console.log(`Using verified ${source.archiveName}.`);
      return;
    }
    await rm(destination, { force: true });
  }

  const temporary = `${destination}.partial`;
  await rm(temporary, { force: true });
  const response = await fetch(source.url, {
    redirect: "follow",
    headers: { "user-agent": "soloradish/ffmpeg-dist source fetcher" },
  });
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${source.url}: HTTP ${response.status}.`);
  }
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));

  const actual = await sha256File(temporary);
  if (actual !== source.sha256) {
    await rm(temporary, { force: true });
    throw new Error(`${source.archiveName} SHA-256 mismatch: expected ${source.sha256}, got ${actual}.`);
  }
  await rename(temporary, destination);
  console.log(`Downloaded and verified ${source.archiveName}.`);
}

const outputDirectory = path.resolve(argument("--output", "source-archives"));
const { build, deps } = await readLocks();
validateLocks(build, deps);
await mkdir(outputDirectory, { recursive: true });
for (const source of [build.source, ...deps.dependencies]) {
  await download(source, outputDirectory);
}
