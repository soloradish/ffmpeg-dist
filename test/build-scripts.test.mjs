import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { root } from "../scripts/lib/config.mjs";

test("native build scripts pin toolchains and avoid optional upstream programs", async () => {
  const build = await readFile(path.join(root, "scripts/build.sh"), "utf8");
  const verify = await readFile(path.join(root, "scripts/verify-build.sh"), "utf8");

  assert.match(build, /--cc="\$cc"/);
  assert.match(build, /--cxx="\$ffmpeg_cxx"/);
  assert.match(build, /make -C lib -j"\$jobs" libvorbis\.la libvorbisfile\.la libvorbisenc\.la/);
  assert.match(build, /make -C lib install-libLTLIBRARIES/);
  assert.match(build, /extra_ldflags="-static -static-libgcc"/);
  assert.match(verify, /--cc=musl-gcc/);
  assert.match(verify, /libvpx-vp9/);
});
