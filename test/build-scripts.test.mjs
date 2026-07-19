import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { root } from "../scripts/lib/config.mjs";

test("native build scripts pin toolchains and avoid optional upstream programs", async () => {
  const build = await readFile(path.join(root, "scripts/build.sh"), "utf8");
  const verify = await readFile(path.join(root, "scripts/verify-build.sh"), "utf8");
  const packageWindows = await readFile(path.join(root, "scripts/package-windows.ps1"), "utf8");

  assert.match(build, /--cc="\$cc"/);
  assert.match(build, /--cxx="\$ffmpeg_cxx"/);
  assert.match(build, /make -C lib -j"\$jobs" libvorbis\.la libvorbisfile\.la libvorbisenc\.la/);
  assert.match(build, /make -C lib install-libLTLIBRARIES/);
  assert.match(build, /extra_ldflags="-static -static-libgcc"/);
  assert.match(build, /extra_libs="-lws2_32 -lbcrypt"/);
  assert.equal(verify.split("| tr -d '\\r'").length - 1, 7);
  assert.match(verify, /--cc=musl-gcc/);
  assert.match(verify, /libvpx-vp9/);
  assert.match(verify, /-i https:\/\/127\.0\.0\.1:18443\/tone\.wav/);
  assert.match(verify, /trap on_error ERR/);
  assert.match(verify, /MSYS2_ARG_CONV_EXCL='\/CN=localhost' openssl req/);
  assert.match(packageWindows, /GetFullPath\(\$Destination\)/);
  assert.match(packageWindows, /DestinationPath \$resolvedDestination/);
});
