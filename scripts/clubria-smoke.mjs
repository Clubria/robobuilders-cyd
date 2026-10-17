import assert from 'node:assert/strict';
import { openPage, settings } from '../server/render.mjs';
import { inputController } from '../server/input.mjs';

const config = settings({ FRAME_SOURCE: 'clubria', WIDTH: '240', HEIGHT: '320', VIEW_WIDTH: '240', VIEW_HEIGHT: '320', CAPTURE_WAIT_MS: '4000' });
const { browser, page } = await openPage(config);
const controls = inputController(page, config);
try {
  await page.waitForSelector('.c-event-timer');
  await page.waitForSelector('#cyd-events button');
  await page.waitForFunction(() => {
    const card = document.querySelector('[data-cyd-consent]');
    return card && getComputedStyle(card).display === 'none';
  });
  const metrics = await page.evaluate(() => ({
    width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
    recorder: !!document.querySelector('.c-compact-recorder'), slides: !!document.querySelector('.c-timer-bottom-bar'),
    events: document.querySelectorAll('#cyd-events button').length,
  }));
  assert.equal(metrics.width, 240); assert.equal(metrics.height, 320); assert.equal(metrics.overflow, false);
  await page.screenshot({ path: 'artifacts/clubria-tft-timer.png' });
  const point = await page.$eval('#cyd-events summary', node => { const r=node.getBoundingClientRect(); return { x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2) }; });
  await controls.input({ action: 'tap', ...point }, 'preview');
  assert.equal(await page.$eval('#cyd-events', n => n.open), true);
  await page.screenshot({ path: 'artifacts/clubria-tft-events.png' });
  await controls.input({ action: 'tap', ...point }, 'preview');
  // Scrolling is checked on a local fixture. Never touch live record/slide actions.
  await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><div style="height:2000px;background:linear-gradient(white,black)">Scroll fixture</div>');
  await controls.input({ action:'pointer',phase:'down',x:100,y:260 },'preview');
  for (const y of [230,190,150,110,70]) await controls.input({ action:'pointer',phase:'move',x:100,y },'preview');
  await controls.input({ action:'pointer',phase:'up',x:100,y:70 },'preview');
  await page.waitForFunction(() => scrollY > 30);
  console.log('PASS: live timer loads at240x320, analytics prompt hidden without a consent click, event picker responds to touch, fixture swipes scroll.');
  console.log(JSON.stringify(metrics));
} finally { await controls.stop(); await browser.close(); }
