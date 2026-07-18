import { writeFile } from "node:fs/promises";
import path from "node:path";
import { readLocks, releaseTag } from "./lib/config.mjs";

const output = path.resolve(process.argv[2] ?? ".work/RELEASE_NOTES.md");
const { build } = await readLocks();
const tag = releaseTag(build);
const body = `# ffmpeg-dist ${tag}\n\nThis is an independent, unofficial distribution of FFmpeg ${build.ffmpegVersion}. It is not affiliated with, endorsed by, sponsored by, or supported by the FFmpeg project.\n\nChoose **core** for local-media applications or **extended** for HTTPS and the explicitly locked external codecs. Always verify the asset SHA-256 against \`SHA256SUMS.txt\` or \`ffmpeg-dist-manifest-v1.json\`.\n\nThe corresponding upstream sources are attached as \`${tag.replace(/^v/, "ffmpeg-")}-sources.tar.xz\`; build instructions are preserved at this repository tag.\n`;
await writeFile(output, body, "utf8");
