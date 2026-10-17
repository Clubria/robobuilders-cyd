import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import puppeteer from 'puppeteer';
import { settings } from '../server/render.mjs';

const header = await readFile(new URL('../firmware/cyd_pixsim/setup_page.h', import.meta.url), 'utf8');
const template = header.match(/R"html\(([\s\S]*)\)html";/)?.[1];
assert.ok(template);
const html = template.replace('__SSID__', 'Example network').replaceAll('__SERVER__', 'http://192.168.1.10:3088').replace('__HAS_PASSWORD__', 'true').replace('__SAVED_CONNECTIONS__', '<option value="">Choose a saved connection</option><option value="Other saved network" data-server="http://192.168.1.20:3088" data-secured="true">Other saved network</option>');
const hostileName = '"><img src=x onerror="window.ssidInjected=true">';
let scans = 0, saves = 0;
const server = createServer(async (req, res) => {
  if (req.url === '/networks') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(++scans === 1 ? { scanning: true, networks: [] } : { scanning: false, networks: ['Example network', hostileName] }));
  } else if (req.url === '/save') {
    let body = '';
    for await (const chunk of req) body += chunk;
    const data = new URLSearchParams(body);
    assert.equal(data.get('ssid'), saves < 3 ? 'Example network' : 'Fresh network');
    assert.equal(data.get('password'), saves < 2 || saves === 3 ? 'fixture-only' : '');
    saves++;
    res.writeHead(saves === 1 ? 400 : 200, { 'Content-Type': 'text/plain' });
    res.end(saves === 1 ? 'Use a valid bridge base URL.' : 'Saved');
  } else if (req.url === '/status') {
    res.setHeader('Content-Type', 'application/json'); res.end('{"failed":true}');
  } else { res.setHeader('Content-Type', 'text/html'); res.end(html); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const browser = await puppeteer.launch({ headless: true, executablePath: settings({}).executablePath });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(await page.$eval('#advanced', node => node.open), false);
  assert.equal(await page.$eval('#server', node => node.value), 'http://192.168.1.10:3088');
  assert.equal(await page.$eval('#save', node => node.textContent), 'Connect');
  await page.click('#scan');
  await page.waitForFunction(() => document.querySelector('#networks').children.length === 2);
  assert.equal(await page.$eval('#networks option:last-child', node => node.value), hostileName);
  assert.equal(await page.evaluate(() => !!window.ssidInjected || !!document.querySelector('img')), false);
  await page.type('#password', 'fixture-only');
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Use a valid bridge base URL.');
  await page.waitForFunction(() => !document.querySelector('#save').disabled);
  assert.equal(await page.$eval('#password', node => node.value), 'fixture-only', 'Validation failure allows correction without erasing entry');
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Could not join'));
  assert.equal(await page.$eval('#password', node => node.value), '', 'Clear submitted password from the page after Save');
  assert.equal(await page.$eval('#save', node => node.disabled), false);
  assert.equal(await page.$eval('#scan', node => node.disabled), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.equal(saves, 2);
  assert.equal(await page.$eval('#password', node => node.required), false);
  await page.click('#save');
  await page.waitForFunction(() => document.querySelector('#status').textContent.startsWith('Could not join'));
  assert.equal(saves, 3, 'Bridge-only edit can reuse saved password without exposing it');
  await page.$eval('#ssid', node => { node.value = 'Different network'; node.dispatchEvent(new Event('input')); });
  assert.equal(await page.$eval('#password', node => node.required), true);
  await page.click('#advanced summary');
  await page.click('#open');
  assert.equal(await page.$eval('#password', node => node.disabled), true);
  await page.select('#saved', 'Other saved network');
  assert.equal(await page.$eval('#ssid', node => node.value), 'Other saved network');
  assert.equal(await page.$eval('#server', node => node.value), 'http://192.168.1.20:3088');
  assert.equal(await page.$eval('#password', node => node.value), '');
  assert.equal(await page.$eval('#password', node => node.required), false);
  assert.equal(await page.$eval('#password', node => node.disabled), false);
  await page.$eval('#ssid', node => { node.value = 'Fresh network'; node.dispatchEvent(new Event('input')); });
  await page.type('#password', 'fixture-only');
  await page.click('#save');
  await page.waitForFunction(() => !document.querySelector('#save').disabled);
  assert.equal(saves, 4);
  assert.equal(await page.$eval('#password', node => node.required), false, 'Newly saved password can be reused without reloading');
  assert.equal(await page.$eval('#password', node => node.value), '');
  await page.click('#save');
  await page.waitForFunction(() => !document.querySelector('#save').disabled);
  assert.equal(saves, 5, 'New connection can be saved again with blank password');
  console.log('PASS: phone setup page, bounded scan, hostile SSID safety, save validation/retry, join-failure status, password clearing and narrow layout.');
} finally {
  await browser.close();
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
}
