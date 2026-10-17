import assert from 'node:assert/strict';
import test from 'node:test';
import { inputController } from '../server/input.mjs';

function fakePage() {
  const events = [];
  return {
    events,
    mouse: {
      move: async (x, y, options) => { assert.equal(options?.steps ?? 1, 1); events.push(['move', x, y]); },
      down: async () => { events.push(['down']); }, up: async () => { events.push(['up']); },
      click: async (x, y) => { events.push(['click', x, y]); },
    },
    keyboard: {
      press: async key => { events.push(['press', key]); },
      down: async key => { events.push(['keyDown', key]); }, up: async key => { events.push(['keyUp', key]); },
    },
  };
}
const config = { width: 320, height: 240, viewWidth: 640, viewHeight: 480 };

test('mobile pages use native scaled touch drags, taps and cancellation', async t => {
  const page = fakePage();
  page.touchscreen = {
    touchStart: async (x, y) => page.events.push(['touchStart', x, y]),
    touchMove: async (x, y) => page.events.push(['touchMove', x, y]),
    touchEnd: async () => page.events.push(['touchEnd']),
    tap: async (x, y) => page.events.push(['tap', x, y]),
  };
  const controls = inputController(page, { ...config, touchInput: true });
  t.after(() => controls.stop());
  await controls.input({ action: 'pointer', phase: 'down', x: 10, y: 100 }, 'usb');
  await controls.input({ action: 'pointer', phase: 'move', x: 10, y: 30 }, 'usb');
  await controls.input({ action: 'pointer', phase: 'up', x: 10, y: 30 }, 'usb');
  await controls.input({ action: 'tap', x: 20, y: 20 }, 'usb');
  await controls.input({ action: 'pointer', phase: 'down', x: 20, y: 20 }, 'usb');
  await controls.input({ action: 'pointer', phase: 'cancel' }, 'usb');
  assert.deepEqual(page.events, [['touchStart',20,200],['touchMove',20,60],['touchEnd'],['tap',40,40],['touchStart',40,40],['touchEnd']]);
  assert.equal(controls.getStats().pointerHeld, false);
});

test('scaled down/move/up maps coordinates and never makes an extra click', async t => {
  const page = fakePage(), controls = inputController(page, config);
  t.after(() => controls.stop());
  await controls.input({ action: 'pointer', phase: 'down', x: 10, y: 20 }, 'usb');
  await controls.input({ action: 'pointer', phase: 'move', x: 100, y: 110 }, 'usb');
  await controls.input({ action: 'pointer', phase: 'up', x: 120, y: 130 }, 'usb');
  assert.deepEqual(page.events, [['move', 20, 40], ['down'], ['move', 200, 220], ['move', 240, 260], ['up']]);
  assert.equal(controls.getStats().pointerHeld, false);
});

test('move floods coalesce without losing release', async t => {
  const page = fakePage();
  let release;
  page.mouse.down = () => new Promise(resolve => { release = resolve; });
  const controls = inputController(page, config);
  t.after(() => controls.stop());
  const down = controls.input({ action: 'pointer', phase: 'down', x: 1, y: 2 }, 'usb');
  await new Promise(resolve => setImmediate(resolve));
  const requests = [];
  for (let i = 0; i < 100; i++) requests.push(controls.input({ action: 'pointer', phase: 'move', x: i, y: 2 }, 'usb'));
  const up = controls.input({ action: 'pointer', phase: 'up', x: 99, y: 2 }, 'usb');
  assert.equal(controls.getStats().inputQueue, 2);
  release(); await Promise.all([down, up, ...requests]);
  assert.equal(controls.getStats().coalescedMoves, 99);
  assert.equal(page.events.at(-1)[0], 'up');
});

test('stationary double-taps do not waste round trips on identical moves', async t => {
  const page = fakePage(), controls = inputController(page, config);
  t.after(() => controls.stop());
  for (let i = 0; i < 2; i++) {
    await controls.input({ action: 'pointer', phase: 'down', x: 10, y: 20 }, 'usb');
    await controls.input({ action: 'pointer', phase: 'up', x: 10, y: 20 }, 'usb');
  }
  assert.deepEqual(page.events, [['move', 20, 40], ['down'], ['up'], ['down'], ['up']]);
});

test('clients cannot steal an active drag; cancellation releases only own controls', async t => {
  const page = fakePage(), controls = inputController(page, config);
  t.after(() => controls.stop());
  await controls.latch(1);
  await controls.input({ action: 'pointer', phase: 'down', x: 1, y: 2 }, 'preview');
  await assert.rejects(controls.input({ action: 'pointer', phase: 'move', x: 3, y: 4 }, 'usb'), /another input/);
  await controls.input({ action: 'pointer', phase: 'cancel' }, 'usb');
  assert.equal(controls.getStats().pointerHeld, true);
  assert.deepEqual(controls.getStats().heldKeys, []);
  await controls.input({ action: 'pointer', phase: 'cancel' }, 'preview');
  assert.equal(controls.getStats().pointerHeld, false);
});

test('held keyboard actions and latches release on stop', async () => {
  const page = fakePage(), controls = inputController(page, config);
  await controls.input({ action: 'key', phase: 'down', key: 'ArrowLeft' }, 'usb');
  await controls.input({ action: 'key', phase: 'down', key: 'ArrowLeft' }, 'usb');
  await controls.input({ action: 'key', phase: 'up', key: 'ArrowLeft' }, 'usb');
  assert.equal(page.events.filter(event => event[0] === 'keyDown').length, 1);
  await controls.latch(1); await controls.stop();
  assert.deepEqual(page.events.at(-1), ['keyUp', 'ArrowRight']);
});

test('up/down/up under backpressure does not merge across the second press', async t => {
  const page = fakePage(); let release;
  page.mouse.down = async () => { page.events.push(['down']); if (!release) await new Promise(resolve => { release = resolve; }); };
  const controls = inputController(page, config); t.after(() => controls.stop());
  const first = controls.input({ action: 'pointer', phase: 'down', x: 1, y: 1 }, 'usb');
  await new Promise(resolve => setImmediate(resolve));
  const up1 = controls.input({ action: 'pointer', phase: 'up', x: 1, y: 1 }, 'usb');
  const down2 = controls.input({ action: 'pointer', phase: 'down', x: 2, y: 2 }, 'usb');
  const up2 = controls.input({ action: 'pointer', phase: 'up', x: 2, y: 2 }, 'usb');
  release(); await Promise.all([first, up1, down2, up2]);
  assert.equal(page.events.filter(event => event[0] === 'up').length, 2);
  assert.equal(controls.getStats().pointerHeld, false);
});

test('latch cannot steal a held key from a different client', async t => {
  const controls = inputController(fakePage(), config); t.after(() => controls.stop());
  await controls.input({ action: 'key', phase: 'down', key: 'ArrowRight' }, 'preview');
  await assert.rejects(controls.latch(1), /another input client/);
  await controls.input({ action: 'key', phase: 'up', key: 'ArrowRight' }, 'preview');
  assert.deepEqual(controls.getStats().heldKeys, []);
});

test('shutdown releases an input that completes after stop was requested', async () => {
  const page = fakePage(); let release;
  page.mouse.down = () => new Promise(resolve => { release = resolve; });
  const controls = inputController(page, config);
  const down = controls.input({ action: 'pointer', phase: 'down', x: 1, y: 1 }, 'usb');
  await new Promise(resolve => setImmediate(resolve));
  const stopping = controls.stop();
  release(); await down; await stopping;
  assert.deepEqual(page.events.at(-1), ['up']);
  assert.equal(controls.getStats().pointerHeld, false);
});
