import test from 'node:test';
import assert from 'node:assert/strict';
import { settings } from '../server/render.mjs';
import { prepareCompact, compactUi, compactPreferences } from '../server/compact.mjs';

test('Clubria uses native touch and never inherits Pixsim adaptations', () => {
  const config = settings({ FRAME_SOURCE: 'clubria', WIDTH: '240', HEIGHT: '320', VIEW_WIDTH: '240', VIEW_HEIGHT: '320' });
  assert.equal(config.touchInput, true);
  assert.match(config.pageURL, /timer\?record=1&cyd=mini$/);
  assert.equal(config.cacheDir, undefined);
  for (const flag of ['CYD_COMPACT', 'CYD_PORTRAIT', 'CYD_CONTROLS']) {
    assert.throws(() => settings({ FRAME_SOURCE: 'clubria', [flag]: '1' }), /must not use Pixsim/);
  }
  assert.throws(() => settings({ FRAME_SOURCE: 'clubria', CLUBRIA_URL: 'file:///private' }), /HTTP\(S\)/);
  assert.equal(settings({}).touchInput, false);
});

test('compact and persistent caching are opt-in and confined to an isolated profile', () => {
  assert.equal(settings({}).compact, false);
  assert.equal(settings({ CYD_CACHE: '1' }).cacheDir, undefined);
  const compact = settings({ CYD_COMPACT: '1', CYD_CACHE: '1' });
  assert.equal(compact.compact, true);
  assert.match(compact.cacheDir, /\/artifacts\/browser-cache\/cyd-compact\/[a-f0-9]{16}$/);
  assert.notEqual(compact.cacheDir, settings({ CYD_COMPACT: '1', CYD_CACHE: '1', PIXSIM_URL: 'https://other.example' }).cacheDir);
  assert.equal(settings({ CYD_COMPACT: '1' }).cacheDir, undefined);
});

test('compact seeds only its game origin before boot and does not interfere with simulation', async () => {
  const operations = [];
  const page = {
    setCacheEnabled: async value => operations.push(['cache', value]),
    emulateMediaFeatures: async value => operations.push(['media', value]),
    evaluateOnNewDocument: async (seed, origin, prefs) => {
      operations.push(['seed', origin, prefs]);
      const stored = [];
      const originalLocation = globalThis.location, originalStorage = globalThis.localStorage;
      try {
        globalThis.localStorage = { setItem: (...args) => stored.push(args) };
        globalThis.location = { origin: 'https://other.example' };
        seed(origin, prefs);
        assert.equal(stored.length, 0);
        globalThis.location = { origin };
        seed(origin, prefs);
        assert.deepEqual(JSON.parse(stored[0][1]), compactPreferences);
        assert.deepEqual(stored[1], ['pixsim_globe_driving', 'off']);
      } finally {
        if (originalLocation === undefined) delete globalThis.location; else globalThis.location = originalLocation;
        if (originalStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = originalStorage;
      }
    },
    addStyleTag: async ({ content }) => {
      assert.ok(content.includes('.character-switch-effect'));
      assert.ok(!content.includes('canvas{display:none'));
      operations.push(['style']);
    },
  };
  await prepareCompact(page, 'https://pixsim.vercel.app');
  await compactUi(page);
  assert.deepEqual(operations.map(item => item[0]), ['cache', 'media', 'seed', 'style']);
});
