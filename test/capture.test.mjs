import assert from 'node:assert/strict';
import test from 'node:test';
import { captureLoop } from '../server/capture.mjs';

test('capture loop does not overlap captures and stops cleanly', { timeout: 3000 }, async () => {
  let calls = 0;
  let release;
  let started;
  const began = new Promise(resolve => { started = resolve; });
  const loop = captureLoop({ fps: 15, initialFrame: Buffer.from('first'), capture: () => {
    calls++;
    started();
    return new Promise(resolve => { release = resolve; });
  } });
  await began;
  // Wait through several nominal capture intervals while the first is in flight.
  await new Promise(resolve => setTimeout(resolve, 200));
  assert.equal(calls, 1);
  const stopping = loop.stop();
  release(Buffer.from('late'));
  await stopping;
  assert.equal(loop.getFrame().buffer.toString(), 'first');
  assert.equal(loop.getStats().capturedFrames, 1);
});

test('failed capture preserves last frame then recovers', { timeout: 3000 }, async () => {
  let calls = 0;
  let recovery;
  const recovered = new Promise(resolve => { recovery = resolve; });
  const loop = captureLoop({ fps: 15, initialFrame: Buffer.from('first'), capture: async () => {
    if (++calls === 1) throw new Error('Browser error');
    recovery();
    return Buffer.from('next');
  } });
  try {
    await recovered;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loop.getFrame().buffer.toString(), 'next');
    assert.equal(loop.getStats().captureErrors, 1);
    assert.equal(loop.getStats().lastCaptureError, null);
  } finally { await loop.stop(); }
});
