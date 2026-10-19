import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import puppeteer from 'puppeteer';
import { settings } from '../server/render.mjs';

const deploymentConfig=JSON.parse(await readFile(new URL('../artifacts/site/vercel.json',import.meta.url),'utf8'));
assert.equal(deploymentConfig.buildCommand,null);
assert.equal(deploymentConfig.outputDirectory,'.');

const files = new Map(await Promise.all([
  ['/', 'index.html', 'text/html'], ['/apps.json', 'apps.json', 'application/json'],
  ['/downloads/cyd-bridge.zip', 'downloads/cyd-bridge.zip', 'application/zip'],
  ['/downloads/ai-builders-app-starter.zip', 'downloads/ai-builders-app-starter.zip', 'application/zip'],
  ['/previews/clubria.jpg', 'previews/clubria.jpg', 'image/jpeg'],
  ['/previews/pixsim.jpg', 'previews/pixsim.jpg', 'image/jpeg'],
].map(async ([route,path,type])=>[route,{type,body:await readFile(new URL(`../artifacts/site/${path}`,import.meta.url))}])));
const server=createServer((req,res)=>{const file=files.get(req.url);res.writeHead(file?200:404,{'Content-Type':file?.type??'text/plain'});res.end(file?.body??'Not found')});
server.listen(0,'127.0.0.1');await once(server,'listening');
const browser=await puppeteer.launch({headless:true,executablePath:settings({}).executablePath});
try {
  const page=await browser.newPage();
  for (const [width,height] of [[240,320],[390,844],[1280,900]]) {
    await page.setViewport({width,height});
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForSelector('.app:nth-child(2)');
    assert.equal(await page.evaluate(()=>document.characterSet),'UTF-8');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.match(await page.title(),/CYD Setup Guide/);
    await page.screenshot({path:`artifacts/public-cyd-site-${width}.png`});
    assert.equal(await page.$$eval('[data-copy]',nodes=>nodes.length),4);
    await page.click('[data-os="windows"]');
    assert.match(await page.$eval('#terminal-label',n=>n.textContent),/PowerShell/);
    await page.click('[data-os="mac"]');
    assert.match(await page.$eval('#terminal-label',n=>n.textContent),/Terminal/);
    await page.click('[data-next="1"]');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'tab-1');
    assert.equal(await page.$eval('#step-1',n=>n.hidden),false);
    assert.equal(await page.$eval('[data-check="0"]',n=>n.checked),false);
    await page.click('#tab-0');
    await page.click('[data-check="0"]');
    assert.equal(await page.$eval('#tab-0',n=>n.classList.contains('done')),true);
    await page.click('#tab-2');
    assert.equal(await page.$eval('#step-2',n=>n.hidden),false);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`artifacts/public-cyd-site-setup-${width}.png`});
    await page.click('#tab-3');
    await page.waitForFunction(()=>[...document.querySelectorAll('.app img')].every(n=>n.complete&&n.naturalWidth>0));
    const cards=await page.$$eval('.app',nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,ratio:r.width/r.height,href:n.href}}));
    assert.equal(cards.length,2);
    assert.ok(cards[1].top>=cards[0].bottom);
    assert.ok(cards.every(c=>Math.abs(c.ratio-3.75)<.02&&c.href.startsWith('https://')));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`artifacts/public-cyd-site-apps-${width}.png`});
    await page.click('#tab-3');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.$eval('#tab-2',n=>n.getAttribute('aria-selected')),'true');
    await page.click('#tab-3');
    await page.click('#reset-checks');
    assert.equal(await page.$eval('[data-check="0"]',n=>n.checked),false);
  }
  const download=await fetch(`http://127.0.0.1:${server.address().port}/downloads/cyd-bridge.zip`);
  assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/zip');
  await download.arrayBuffer();
  const starter=await fetch(`http://127.0.0.1:${server.address().port}/downloads/ai-builders-app-starter.zip`);
  assert.equal(starter.status,200);await starter.arrayBuffer();
  console.log('PASS: four setup tabs, Mac/Windows instructions, manual ticks/reset, keyboard navigation, stacked 15:4 image links, both ZIPs and 240/390/1280 layouts. No live app actions executed.');
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
