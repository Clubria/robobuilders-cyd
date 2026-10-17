import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import puppeteer from 'puppeteer';
import { settings } from '../server/render.mjs';

const files = new Map(await Promise.all([
  ['/', 'index.html', 'text/html'], ['/apps.json', 'apps.json', 'application/json'],
  ['/downloads/cyd-bridge.zip', 'downloads/cyd-bridge.zip', 'application/zip'],
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
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const ratio=await page.$eval('.preview',n=>{const r=n.getBoundingClientRect();return r.width/r.height});
    assert.ok(Math.abs(ratio-3.75)<.02);
    await page.$eval('#next',n=>n.click());
    await page.waitForFunction(()=>document.querySelector('#apps').scrollLeft>100);
    await page.screenshot({path:`artifacts/public-cyd-site-${width}.png`});
  }
  const download=await fetch(`http://127.0.0.1:${server.address().port}/downloads/cyd-bridge.zip`);
  assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/zip');
  console.log('PASS: public guide, two-app carousel,15:4 previews, source ZIP and240/390/1280 layouts. No live app actions executed.');
} finally {await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
