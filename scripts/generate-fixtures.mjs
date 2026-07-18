import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const output = path.resolve(process.argv[2] ?? ".work/fixtures");
await mkdir(output, { recursive: true });

const sampleRate = 16_000;
const samples = sampleRate / 4;
const data = Buffer.alloc(samples * 2);
for (let index = 0; index < samples; index += 1) {
  const value = Math.round(Math.sin((2 * Math.PI * 440 * index) / sampleRate) * 12_000);
  data.writeInt16LE(value, index * 2);
}
const wav = Buffer.alloc(44 + data.length);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(sampleRate, 24);
wav.writeUInt32LE(sampleRate * 2, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(data.length, 40);
data.copy(wav, 44);
await writeFile(path.join(output, "tone.wav"), wav);

const frameSize = 16 * 16;
const frames = [];
for (let frame = 0; frame < 2; frame += 1) {
  frames.push(Buffer.alloc(frameSize, frame === 0 ? 64 : 192));
  frames.push(Buffer.alloc(frameSize / 4, 128));
  frames.push(Buffer.alloc(frameSize / 4, 128));
}
await writeFile(path.join(output, "video.yuv"), Buffer.concat(frames));
