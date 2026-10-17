import assert from 'node:assert/strict';
import { openPage, settings } from '../server/render.mjs';
import { portraitUI } from '../server/portrait.mjs';
import { inputController } from '../server/input.mjs';
import { worldView } from '../server/world-view.mjs';
import { presenceUI } from '../server/presence.mjs';
const config = settings({ FRAME_SOURCE: 'pixsim', CYD_PORTRAIT: '1', CYD_COMPACT: '1', WIDTH: '240', HEIGHT: '320', VIEW_WIDTH: '360', VIEW_HEIGHT: '480',
  PIXSIM_URL: 'https://pixsim.vercel.app/newyork', CAPTURE_WAIT_MS: '20000' });
const { browser, page } = await openPage(config);
let controls;
try {
  await portraitUI(page);
  await worldView(page);
  await presenceUI(page);
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll('.hud-skill-controls button[data-slot-idx]')].filter(node => getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden');
    return nodes.length >= 3 && nodes.every(node => {
      const r = node.getBoundingClientRect();
      const size = node.dataset.slotIdx === '3' ? 72 : 66;
      return Math.abs(r.width - size) < 0.1 && Math.abs(r.height - size) < 0.1 && Math.abs(r.bottom - 477) < 0.1;
    });
  }, { timeout: 15000 });
  const row = await page.$$eval('.hud-skill-controls button[data-slot-idx]', nodes => nodes.filter(node => getComputedStyle(node).display !== 'none' && getComputedStyle(node).visibility !== 'hidden').map(node => {
    const r = node.getBoundingClientRect(); return { slot: node.dataset.slotIdx ?? (node.id === 'cyd-mic' ? 'mic' : 'profile'), x: r.x, y: r.y, w: r.width, h: r.height };
  }).sort((a, b) => a.x - b.x));
  const jumping = await page.$eval('[data-slot-idx="3"]', node => /^jump\b/i.test(node.getAttribute('aria-label').trim()));
  assert.deepEqual(row.map(r => r.slot), ['0', '1', '3']);
  if (jumping) assert.equal(await page.$eval('#cyd-action-caption', node => node.hidden), true);
  assert.ok(row.every((r, i) => !i || r.x >= row[i - 1].x + row[i - 1].w));
  controls = inputController(page, config);
  const avatar = await page.$eval('[aria-label="Choose your character"]', node => {
    const r = node.getBoundingClientRect(); return { x: (r.x + r.width / 2) * 2 / 3, y: (r.y + r.height / 2) * 2 / 3 };
  });
  await controls.input({ action: 'tap', ...avatar }, 'usb');
  await page.waitForSelector('button[aria-label="Close character menu"]', {visible:true,timeout:15000});
  assert.equal(await page.$$eval('.game-chat-column', nodes => nodes.every(node => getComputedStyle(node).display === 'none')), true);
  const tap = async selector => {
    const hit = await page.$eval(selector, node => {const r=node.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {ok:node===hit||node.contains(hit),x:r.x,y:r.y,width:r.width,height:r.height,hitClass:hit?.className};});
    if (!hit.ok) await page.screenshot({path:'artifacts/portrait-overlap.png'});
    assert.ok(hit.ok, `${selector} touch target is covered: ${JSON.stringify(hit)}`);
    const point = await page.$eval(selector, node => { const r=node.getBoundingClientRect();return {x:Math.floor((r.x+r.width/2)*2/3),y:Math.floor((r.y+r.height/2)*2/3)}; });
    await controls.input({action:'tap',...point},'usb');
  };
  const before = await page.$eval('button[aria-label^="Use "]', node=>node.getAttribute('aria-label'));
  await tap('button[aria-label="Next character"]');
  await page.waitForFunction(before=>document.querySelector('button[aria-label^="Use "]')?.getAttribute('aria-label')!==before, {timeout:15000},before);
  await page.waitForFunction(() => {const button=document.querySelector('button[aria-label^="Use "]');return button && !button.disabled}, {timeout:20000});
  await tap('button[aria-label^="Use "]');
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Close character menu"]') || !!document.querySelector('[aria-label="Character already played"]'), {timeout:15000});
  if (await page.$('[aria-label="Character already played"]')) {
    await tap('button[aria-label="Close character menu"]');
    console.log('Native already-played confirmation respected; no duplicate character forced.');
  }
  await page.waitForSelector('button[aria-label="Close character menu"]', {hidden:true,timeout:15000});
  await controls.input({action:'tap',...avatar},'usb');
  await page.waitForSelector('#cyd-hub', {visible:true,timeout:15000});
  await tap('#cyd-hub');
  await page.waitForSelector('[data-testid="hub-directory"]', {visible:true,timeout:15000});
  await page.waitForSelector('#cyd-hub-filter', {visible:true,timeout:15000});
  const hubBox = await page.$eval('[data-testid="hub-directory"]', n => {const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}});
  assert.ok(hubBox.x >= 0 && hubBox.y >= 0 && hubBox.right <= 360 && hubBox.bottom <= 480, 'Hub fits the physical screen');
  assert.equal(await page.$eval('#cyd-hub-filter button', n=>n.getAttribute('aria-pressed')), 'true');
  await tap('[aria-label="Close Hub"]');
  await page.waitForSelector('[data-testid="hub-directory"]', {hidden:true,timeout:15000});
  await page.waitForFunction(()=>window.__cydPresenceStats?.still, {timeout:15000});
  await controls.input({action:'pointer',phase:'down',x:90,y:230},'usb');
  await controls.input({action:'pointer',phase:'move',x:150,y:230},'usb');
  const walking = await page.evaluate(() => (window.__cydCapturedGame ?? window.__PIXSIM_GAME__)?.scene.getScene('GameScene')?.inputManager?.getMovementVector()?.raw?.x);
  assert.ok(walking > 0, 'A direct canvas slide activates native walking');
  await page.waitForFunction(()=>!window.__cydPresenceStats.still, {timeout:3000});
  await controls.input({action:'pointer',phase:'up',x:150,y:230},'usb');
  assert.equal(await page.evaluate(() => (window.__cydCapturedGame ?? window.__PIXSIM_GAME__)?.scene.getScene('GameScene')?.inputManager?.getMovementVector()?.raw?.x), 0, 'Release stops native walking');
  await tap('button[aria-label="World map"]');
  await page.waitForSelector('.globe-legend', {visible:true,timeout:20000});
  assert.equal(await page.evaluate(() => localStorage.getItem('pixsim_globe_driving')), 'off');
  assert.equal(await page.$eval('.globe-drive-option', node => node.getAttribute('aria-pressed')), 'false');
  assert.equal(await page.$eval('.globe-drive-controls', node => getComputedStyle(node).display), 'none');
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.screenshot({ path: 'artifacts/portrait-final.jpg', type: 'jpeg', quality: 70 });
  console.log('PASS: production profile picker, character next/confirm, direct Hub navigation/filter/close via forwarded taps, screen bounds, hidden chat and compact geometry.');
  console.log(JSON.stringify(row));
} finally { await controls?.stop(); await browser.close(); }
