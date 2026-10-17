import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { CDPSessionEvent } from 'puppeteer';
import { screencastCapture } from '../server/screencast.mjs';

const jpeg = Buffer.from([0xff, 0xd8, 1, 0xff, 0xd9]);
class Session extends EventEmitter {
  commands = [];
  async send(method, params) { this.commands.push([method, params]); }
  async detach() { this.detached = true; }
  frame(buffer = jpeg) { this.emit('Page.screencastFrame', { sessionId: this.commands.length, data: buffer.toString('base64') }); }
}
const options = { fps: 24, width: 240, height: 320, quality: 35, initialFrame: jpeg };

test('screencast caps publication at 24 FPS, ACKs every frame and never builds a queue', async () => {
  const session = new Session(); let at = 0;
  const loop = await screencastCapture({ ...options, session, now: () => at });
  assert.deepEqual(session.commands[0], ['Page.startScreencast', { format: 'jpeg', quality: 35, maxWidth: 240, maxHeight: 320, everyNthFrame: 1 }]);
  for (let i = 0; i < 600; i++) { at = i * 1000 / 60; session.frame(); }
  assert.equal(loop.getStats().screencastFrames, 600);
  assert.ok(Math.abs(loop.getStats().capturedFrames - 241) <= 1);
  assert.equal(session.commands.filter(([method]) => method === 'Page.screencastFrameAck').length, 600);
  assert.deepEqual(loop.getFrame().buffer, jpeg);
  assert.equal(loop.getStats().captureMs, null, 'Do not mislabel event-handling time as capture duration');
  await loop.stop(); await loop.stop();
  const sequence = loop.getFrame().sequence;
  session.frame();
  assert.equal(loop.getFrame().sequence, sequence);
  assert.equal(session.detached, true);
  assert.equal(session.listenerCount('Page.screencastFrame'), 0);
});

test('invalid or oversized JPEGs retain last good frame; a valid frame recovers', async () => {
  const session = new Session();
  const loop = await screencastCapture({ ...options, session });
  try {
    session.frame(Buffer.from('bad')); session.frame(Buffer.alloc(65537));
    assert.equal(loop.getFrame().sequence, 1);
    assert.equal(loop.getStats().captureErrors, 2);
    session.frame();
    assert.equal(loop.getFrame().sequence, 2);
    assert.equal(loop.getStats().lastCaptureError, null);
    session.emit(CDPSessionEvent.Disconnected);
    assert.equal(loop.getStats().captureErrors, 3);
  } finally { await loop.stop(); }
});

test('startup failure releases the screencast session', async () => {
  const session = new Session();
  session.send = async method => { if (method === 'Page.startScreencast') throw new Error('Unavailable'); };
  await assert.rejects(screencastCapture({ ...options, session }), /Unavailable/);
  assert.equal(session.detached, true);
  assert.equal(session.listenerCount('Page.screencastFrame'), 0);
});

test('ACK failures are recorded without an unhandled rejection', async () => {
  const session = new Session();
  session.send = async method => { if (method === 'Page.screencastFrameAck') throw new Error('Connection lost'); };
  const loop = await screencastCapture({ ...options, session });
  try {
    session.frame();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(loop.getStats().captureErrors, 1);
    assert.match(loop.getStats().lastCaptureError, /screencast failed/);
  } finally { await loop.stop(); }
});
