import assert from 'node:assert/strict';
import { openPage, settings } from '../server/render.mjs';
import { portraitUI } from '../server/portrait.mjs';
import { worldView } from '../server/world-view.mjs';

const config = settings({ FRAME_SOURCE: 'pixsim', CYD_PORTRAIT: '1', CYD_COMPACT: '1', WIDTH: '240', HEIGHT: '320',
  VIEW_WIDTH: '360', VIEW_HEIGHT: '480', PIXSIM_URL: 'https://pixsim.vercel.app/newyork', CAPTURE_WAIT_MS: '20000' });
const { browser, page } = await openPage(config);
try {
  await page.waitForFunction(() => window.__cydCapturedGame?.scene.getScene('GameScene')?.chatBubbleManager?._createBubble, { timeout: 15000 });
  await page.evaluate(() => {
    const manager = window.__cydCapturedGame.scene.getScene('GameScene').chatBubbleManager;
    for (const bubble of manager.bubbles) bubble.container.destroy();
    manager.bubbles = [];
    manager._createBubble('You', 'Hello! The larger text should be easy to read without losing the road.', 'local', null);
    manager._createBubble('Jordan Example', 'Swipe to walk, double-tap to interact. LongWordsMustWrapWithoutClippingAtTheScreenEdge.', 'npc', null);
    for (const bubble of manager.bubbles) {
      bubble.message.setText(bubble.reveal?.text ?? bubble.message.text);
      bubble.reveal = undefined; bubble.lifetime = 600000;
    }
  });
  const variants = [
    { name: 'compact', fontScale: 1.5, secondary: 42, action: 50, bubbleFont: 24, nameFont: 22, offsetY: -5, bubbleHeight: 154 },
    { name: 'readable', fontScale: 1.65, secondary: 44, action: 52, bubbleFont: 27, nameFont: 24, offsetY: -8, bubbleHeight: 174 },
    { name: 'large', fontScale: 1.8, secondary: 44, action: 54, bubbleFont: 30, nameFont: 27, offsetY: -11, bubbleHeight: 194 },
  ];
  for (const variant of variants) {
    await portraitUI(page, variant); await worldView(page, variant);
    await page.waitForFunction(() => window.__cydWorldStats.attached && window.__cydWorldStats.cameraApplied && document.querySelectorAll('#cyd-speech article').length === 2);
    const result = await page.evaluate(() => {
      const r = devicePixelRatio;
      const box = node => { const b = node.getBoundingClientRect(); return { x: b.x * r, y: b.y * r, w: b.width * r, h: b.height * r, bottom: b.bottom * r, right: b.right * r }; };
      const speech = document.querySelector('#cyd-speech');
      return { world: { ...window.__cydWorldStats }, speech: box(speech), overflow: speech.scrollWidth > speech.clientWidth,
        font: parseFloat(getComputedStyle(speech.querySelector('p')).fontSize) * r,
        globe: box(document.querySelector('[aria-label="World map"]')), profile: box(document.querySelector('[data-cyd-avatar]')),
        row: [...document.querySelectorAll('.hud-skill-controls button[data-slot-idx]')].filter(n => getComputedStyle(n).display !== 'none').map(n => ({ slot: n.dataset.slotIdx, ...box(n) })).sort((a, b) => a.x - b.x) };
    });
    assert.ok(Math.abs(result.speech.w - 228) < .03, 'Speech width is 95% of the physical screen');
    assert.equal(result.overflow, false, 'Long words never spill off-screen');
    assert.ok(Math.abs(result.profile.x - 5) < .03 && Math.abs(result.profile.bottom - 318) < .03);
    assert.deepEqual(result.row.map(n => n.slot), ['0', '1', '3']);
    assert.ok(result.row.every(n => Math.abs(n.bottom - 318) < .03));
    assert.ok(Math.abs(result.row.at(-1).right - 235) < .03);
    assert.ok(result.row.every((n, i) => !i || n.x >= result.row[i - 1].right));
    await page.click('#cyd-speech article:first-child button');
    assert.equal(await page.$eval('#cyd-speech article:first-child button', n => n.getAttribute('aria-expanded')), 'true');
    await page.click('#cyd-speech article:last-child button');
    assert.equal(await page.$eval('#cyd-speech article:last-child button', n => n.getAttribute('aria-expanded')), 'true');
    assert.equal(await page.$$eval('#cyd-speech p:not([hidden])', nodes => nodes.length), 1, 'Stack expands one message at a time without losing earlier text');
    await page.screenshot({ path: `artifacts/cyd-layout-${variant.name}.jpg`, type: 'jpeg', quality: 85 });
    console.log(JSON.stringify({ variant: variant.name, ...result }));
  }
  console.log('PASS: three production-scene layout experiments, 1.1x camera, enlarged names/speech, 95%-width wrapping, corner insets and action order.');
} finally {
  await page.evaluate(() => { window.__cydPortraitCleanup?.(); window.__cydWorldCleanup?.(); }).catch(() => {});
  await browser.close();
}
