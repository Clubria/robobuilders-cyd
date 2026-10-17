import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { openPage, settings } from '../server/render.mjs';
import { portraitUI } from '../server/portrait.mjs';

const config = settings({ FRAME_SOURCE: 'pixsim', CYD_COMPACT: '1', WIDTH: '240', HEIGHT: '320',
  VIEW_WIDTH: '360', VIEW_HEIGHT: '480', PIXSIM_URL: 'https://pixsim.vercel.app/newyork', CAPTURE_WAIT_MS: '20000' });
const { browser, page } = await openPage(config);
try {
  await portraitUI(page);
  await page.waitForFunction(() => {
    const buttons = [...document.querySelectorAll('.hud-skill-controls button[data-slot-idx]')];
    return buttons.length === 3 && buttons.every(node => {
      const r = node.getBoundingClientRect();
      return r.width >= 72 && Math.abs(r.bottom - 468) < 0.1;
    });
  }, { timeout: 20000 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('pixsim_animation_preferences')).mode), 'lightweight');
  // Freeze only this comparison's PNG, not the running game's simulation. Every
  // quality uses the same source pixels so movement cannot bias the size comparison.
  const png = await page.screenshot({ type: 'png' });
  const comparison = await browser.newPage();
  await comparison.setViewport({ width: 240, height: 320, deviceScaleFactor: 1 });
  await comparison.setContent(`<style>body{margin:0}img{display:block;width:240px;height:320px}</style><img src="data:image/png;base64,${Buffer.from(png).toString('base64')}">`);
  await comparison.waitForFunction(() => document.querySelector('img').complete);
  await mkdir('artifacts/latency', { recursive: true });
  const results = [];
  for (const quality of [25, 30, 35, 40, 45, 55]) {
    const start = performance.now();
    const image = await comparison.screenshot({ type: 'jpeg', quality });
    results.push({ quality, bytes: image.length, screenshotMs: Math.round(performance.now() - start),
      minimumUartMs: Math.ceil((image.length + 12) * 10 / 115200 * 1000) });
    await writeFile(`artifacts/latency/quality-${quality}.jpg`, image);
  }
  await writeFile('artifacts/latency/encoding.json', JSON.stringify({ note: 'Same 240x320 pixels; theoretical 115200-baud wire floor excludes decode/ACK/other overhead. Not measured device FPS.', results }, null, 2) + '\n');
  console.log('PASS: compact preferences/reduced motion applied before game boot.');
  console.table(results);
} finally { await browser.close(); }
