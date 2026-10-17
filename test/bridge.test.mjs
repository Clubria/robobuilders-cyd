import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import test from 'node:test';
import { createBridge, validInput } from '../server/bridge.mjs';
import { settings, assertNavigation } from '../server/render.mjs';

// fetch may suppress custom Host headers; raw HTTP is required to test rebinding.
function rawStatus(url, headers, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request(url, { method, headers }, res => {
      res.resume(); res.once('end', () => resolve(res.statusCode));
    });
    req.once('error', reject); req.end();
  });
}

test('settings default to a small static test, not Pixsim', () => {
  const config = settings({});
  assert.equal(config.source, 'test');
  assert.equal(config.width, 320);
  assert.equal(config.height, 240);
  assert.equal(config.port, 3088);
  assert.equal(config.live, false);
  assert.equal(settings({ STREAM: '1', FRAME_SOURCE: 'pixsim' }).live, true);
  const scaled = settings({ VIEW_WIDTH: '640', VIEW_HEIGHT: '480' });
  assert.equal(scaled.viewWidth, 640);
  assert.equal(scaled.viewHeight, 480);
  assert.throws(() => settings({ VIEW_WIDTH: '640', VIEW_HEIGHT: '240' }), /aspect ratio/);
  const portrait = settings({ WIDTH: '240', HEIGHT: '320', VIEW_WIDTH: '360', VIEW_HEIGHT: '480', CYD_PORTRAIT: '1' });
  assert.equal(portrait.portraitUi, true);
  assert.equal(portrait.width, 240);
  assert.equal(settings({ FPS: '24', CAPTURE_MODE: 'screencast' }).fps, 24);
  assert.equal(settings({}).captureMode, 'screenshot');
  for (const env of [{ FPS: '0' }, { FPS: '61' }, { CAPTURE_MODE: 'video' }, { WIDTH: 'NaN' }, { HEIGHT: '0' }, { PORT: '0' }, { JPEG_QUALITY: '100' }, { FRAME_SOURCE: 'video' }, { PIXSIM_URL: 'file:///etc/passwd' }]) {
    assert.throws(() => settings(env));
  }
});

test('upstream HTTP errors cannot be mistaken for successful Pixsim navigation', () => {
  assert.doesNotThrow(() => assertNavigation({ ok: () => true, status: () => 200 }));
  for (const status of [404, 500, 503]) {
    assert.throws(() => assertNavigation({ ok: () => false, status: () => status }), new RegExp(`HTTP ${status}`));
  }
  assert.throws(() => assertNavigation(null), /no response/);
});

test('live mode serves changing cached frames, multipart stream, and bounded input', async t => {
  let sequence = 1;
  const commands = [];
  const server = createBridge({
    width: 320, height: 240, source: 'pixsim', live: true, fps: 15,
    getFrame: () => ({ buffer: Buffer.from([0xff, 0xd8, sequence, 0xff, 0xd9]), sequence, capturedAt: new Date(Date.now() - 80).toISOString() }),
    getStats: () => ({ capturedFrames: sequence }),
    input: async command => commands.push(command),
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const first = await fetch(base + '/');
  assert.equal(first.headers.get('x-frame-sequence'), '1');
  assert.ok(Number(first.headers.get('x-frame-age-ms')) >= 80);
  sequence = 2;
  assert.equal((await fetch(base + '/frame.jpg')).headers.get('x-frame-sequence'), '2');
  const controller = new AbortController();
  t.after(() => controller.abort());
  const response = await fetch(base + '/stream.mjpg', { signal: controller.signal });
  assert.match(response.headers.get('content-type'), /multipart\/x-mixed-replace/);
  const reader = response.body.getReader();
  assert.match(Buffer.from((await reader.read()).value).toString('latin1'), /--cydframe\r\nContent-Type: image\/jpeg\r\nContent-Length: 5\r\nX-Frame-Sequence: 2/);
  sequence = 3;
  assert.match(Buffer.from((await reader.read()).value).toString('latin1'), /X-Frame-Sequence: 3/);
  controller.abort();
  const send = (body, headers = {}) => fetch(base + '/input', { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body });
  assert.equal((await send('{"action":"key","key":"ArrowRight"}')).status, 200);
  assert.equal((await send('{"action":"tap","x":319,"y":239}')).status, 200);
  assert.equal(commands.length, 2);
  assert.equal((await send('{"action":"pointer","phase":"down","x":100,"y":200}')).status, 200);
  assert.equal((await send('{"action":"pointer","phase":"move","x":200,"y":200}')).status, 200);
  assert.equal((await send('{"action":"pointer","phase":"up","x":200,"y":200}')).status, 200);
  assert.equal((await send('{"action":"pointer","phase":"cancel"}')).status, 200);
  assert.equal((await send('{"action":"pointer","phase":"move","x":320,"y":0}')).status, 400);
  assert.equal((await send('{"action":"tap","x":320,"y":239}')).status, 400);
  assert.equal((await send('null')).status, 400);
  assert.equal((await send('{')).status, 400);
  assert.equal((await send('x'.repeat(1025))).status, 413);
  assert.equal((await send('{}', { Origin: 'http://untrusted.example' })).status, 403);
  assert.equal(await rawStatus(base + '/input', { Origin: 'http://evil.example', Host: 'evil.example' }, 'POST'), 421);
  assert.equal(await rawStatus(base + '/preview', { Host: 'evil.example' }), 421);
  assert.equal(await rawStatus(base + '/health', { Host: `127.0.0.1:${server.address().port + 1}` }), 421);
  assert.equal((await send('{}', { 'Content-Type': 'text/plain' })).status, 415);
  assert.match(await (await fetch(base + '/preview')).text(), /stream.mjpg/);
  const help = await fetch(base + '/cyd');
  assert.equal(help.status, 200);
  assert.match(await help.text(), /USB power alone does not mean data/);
  assert.equal((await fetch(base + '/cyd/download.zip')).status, 503);
  const health = await (await fetch(base + '/health')).json();
  assert.equal(health.mode, 'live-stream');
  assert.equal(health.capturedFrames, 3);
  assert.ok(health.frameAgeMs >= 80);
  assert.equal(validInput({ action: 'key', key: 'F12' }, 320, 240), false);
});

test('image transport is binary, repeatable and reports requests', async t => {
  const frame = Buffer.from([0xff, 0xd8, 0, 0x80, 0xff, 0xd9]);
  const server = createBridge({ frame, bundle: Buffer.from('zip-fixture'), width: 320, height: 240, source: 'test' });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const download = await fetch(base + '/cyd/download.zip');
  assert.equal(download.headers.get('content-type'), 'application/zip');
  assert.equal(await download.text(), 'zip-fixture');
  for (const path of ['/', '/frame.jpg']) {
    const response = await fetch(base + path, { headers: { 'User-Agent': 'ESP32-test-client' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/jpeg');
    assert.equal(response.headers.get('content-length'), String(frame.length));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), frame);
  }
  const status = await (await fetch(base + '/health')).json();
  assert.equal(status.imageRequests, 2);
  assert.equal(status.lastImageRequest.userAgent, 'ESP32-test-client');
  assert.equal(status.mode, 'single-image');
  assert.match(await (await fetch(base + '/preview')).text(), /not a live stream/);
  assert.equal((await fetch(base + '/', { method: 'PUT', body: '{}' })).status, 409);
  assert.equal((await fetch(base + '/missing')).status, 404);
});
