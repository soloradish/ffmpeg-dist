import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha256File } from "./lib/config.mjs";

const directory = path.resolve(process.argv[2] ?? "release-assets");
const names = (await readdir(directory))
  .filter((name) => name !== "SHA256SUMS.txt")
  .sort((left, right) => left.localeCompare(right));
const lines = [];
for (const name of names) {
  lines.push(`${await sha256File(path.join(directory, name))}  ${name}`);
}
await writeFile(path.join(directory, "SHA256SUMS.txt"), `${lines.join("\n")}\n`, "ascii");
