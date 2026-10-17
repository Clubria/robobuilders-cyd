import assert from 'node:assert/strict';
import { once } from 'node:events';
import puppeteer from 'puppeteer';
import { createBridge } from '../server/bridge.mjs';
import { settings } from '../server/render.mjs';

const server = createBridge({ width:240,height:320,source:'clubria',live:true,
  getFrame:()=>({buffer:Buffer.from([255,216,255,217]),sequence:1,capturedAt:new Date().toISOString()}) });
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser = await puppeteer.launch({headless:true,executablePath:settings({}).executablePath});
try {
  const page = await browser.newPage();
  for (const [width,height] of [[240,320],[390,844],[1280,800]]) {
    await page.setViewport({width,height});
    await page.goto(`http://127.0.0.1:${server.address().port}/cyd`);
    await page.waitForFunction(()=>document.querySelector('#computer').textContent.includes('pictures ready'));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.match(await page.$eval('#computer',n=>n.textContent),/No recent screen requests/);
    await page.screenshot({path:`artifacts/cyd-guide-${width}.png`});
  }
  console.log('PASS: help page at240/390/1280 widths; real computer status separated from physical draw evidence.');
} finally { await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r)); }
