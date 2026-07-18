import { readFile, stat } from "node:fs/promises";
import https from "node:https";
import path from "node:path";

const [root, certificatePath, keyPath, portText = "18443"] = process.argv.slice(2);
if (!root || !certificatePath || !keyPath) {
  throw new Error("Usage: https-server.mjs ROOT CERT KEY [PORT]");
}
const resolvedRoot = path.resolve(root);
const server = https.createServer(
  { cert: await readFile(certificatePath), key: await readFile(keyPath) },
  async (request, response) => {
    try {
      const requestPath = decodeURIComponent(new URL(request.url, "https://localhost").pathname);
      const candidate = path.resolve(resolvedRoot, `.${requestPath}`);
      if (!candidate.startsWith(`${resolvedRoot}${path.sep}`)) throw new Error("Invalid path.");
      const info = await stat(candidate);
      if (!info.isFile()) throw new Error("Not a file.");
      response.writeHead(200, { "content-length": info.size, "content-type": "application/octet-stream" });
      response.end(await readFile(candidate));
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  },
);
server.listen(Number(portText), "127.0.0.1", () => console.log(`READY ${portText}`));
