// Read-only local Pixsim dev session exposes its scene for integration verification.
// Native double-tap already shares Space's contextual action; never fire it twice.
import assert from 'node:assert/strict';
import { openPage, settings } from '../server/render.mjs';
import { portraitUI } from '../server/portrait.mjs';
import { inputController } from '../server/input.mjs';

const config = settings({ FRAME_SOURCE: 'pixsim', PIXSIM_URL: 'http://localhost:4736/newyork',
  WIDTH: '240', HEIGHT: '320', VIEW_WIDTH: '360', VIEW_HEIGHT: '480', CYD_COMPACT: '1', CAPTURE_WAIT_MS: '20000' });
const { browser, page } = await openPage(config);
let controls;
try {
  await portraitUI(page);
  await page.waitForFunction(() => window.__PIXSIM_GAME__?.scene.getScene('GameScene')?.inputManager?.onDoubleTapCallback, { timeout: 30000 });
  await page.evaluate(() => {
    const scene = window.__PIXSIM_GAME__.scene.getScene('GameScene');
    window.contextualActions = 0;
    window.tapTimes = [];
    scene.input.on('pointerdown', () => window.tapTimes.push(Date.now()));
    // Spy at the shared boundary, without mounting/talking in a test session.
    scene.handleAction = () => { window.contextualActions++; };
  });
  controls = inputController(page, config);
  const tap = async () => {
    await controls.input({ action: 'pointer', phase: 'down', x: 120, y: 190 }, 'usb');
    await new Promise(resolve => setTimeout(resolve, 40));
    await controls.input({ action: 'pointer', phase: 'up', x: 120, y: 190 }, 'usb');
  };
  await tap();
  const singleActions = await page.evaluate(() => window.contextualActions);
  assert.equal(singleActions, 0, 'Single tap is not Space');
  await tap();
  await page.waitForFunction(() => window.contextualActions === 1);
  assert.equal(await page.evaluate(() => window.contextualActions), 1, 'Exactly one contextual action per double-tap');
  await controls.input({ action: 'key', key: 'Space' }, 'usb');
  await page.waitForFunction(() => window.contextualActions === 2);
  await new Promise(resolve => setTimeout(resolve, 400));
  const avatar = await page.$eval('[data-cyd-avatar]', node => { const r = node.getBoundingClientRect(); return { x: (r.x + r.width / 2) * 2 / 3, y: (r.y + r.height / 2) * 2 / 3 }; });
  await controls.input({ action: 'tap', ...avatar }, 'usb');
  await controls.input({ action: 'tap', ...avatar }, 'usb');
  assert.equal(await page.evaluate(() => window.contextualActions), 2, 'Avatar taps do not activate world actions');
  assert.equal(controls.getStats().pointerHeld, false);
  console.log('PASS: scaled physical down/up double-tap calls the same contextual handler as Space exactly once; avatar taps do not.');
} catch (error) {
  console.error('Double-tap diagnostics', await page.evaluate(() => {
    const scene = window.__PIXSIM_GAME__?.scene.getScene('GameScene');
    return { actions: window.contextualActions, tapTimes: window.tapTimes, target: document.elementFromPoint(180, 285)?.outerHTML.slice(0, 250),
      lastTap: scene?.inputManager?.lastTapTime, ui: scene?.inputManager?.uiInputConfig,
      canvas: document.querySelector('#game-container canvas')?.getBoundingClientRect().toJSON() };
  }));
  throw error;
} finally { await controls?.stop(); await browser.close(); }
