import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { renderFrame, settings } from '../server/render.mjs';

const config = settings();
const frame = await renderFrame(config);
assert.equal(frame.readUInt16BE(0), 0xffd8, 'Must be a JPEG');
assert.equal(frame.readUInt16BE(frame.length - 2), 0xffd9, 'JPEG must not be truncated');
// Baseline JPEG SOF0, needed by the ESP32 JPEG decoder.
let found = false;
for (let i = 2; i + 8 < frame.length;) {
  assert.equal(frame[i], 0xff);
  const marker = frame[i + 1];
  if (marker === 0xc0) {
    assert.equal(frame.readUInt16BE(i + 5), config.height);
    assert.equal(frame.readUInt16BE(i + 7), config.width);
    found = true;
    break;
  }
  if (marker === 0xda) break;
  i += 2 + frame.readUInt16BE(i + 2);
}
assert.ok(found, 'Must be baseline, not progressive JPEG');
await mkdir(new URL('../artifacts/', import.meta.url), { recursive: true });
await writeFile(new URL(`../artifacts/${config.source}-frame.jpg`, import.meta.url), frame);
console.log(`PASS: ${config.source} baseline JPEG ${config.width}x${config.height}, ${frame.length} bytes`);
