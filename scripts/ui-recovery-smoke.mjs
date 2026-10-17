import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import puppeteer from 'puppeteer';
import {settings} from '../server/render.mjs';
import {managedCydUI} from '../server/cyd-ui.mjs';
const server = createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<html><head></head><body><button aria-label="Choose your character">Profile</button><button aria-label="Open group chat">Chat</button><div class="game-chat-column"><input placeholder="Chat"></div><div class="hud-skill-controls"><button data-slot-idx="3" aria-label="Jump">Jump</button></div></body></html>')});
server.listen(0,'127.0.0.1'); await once(server,'listening');
const browser = await puppeteer.launch({headless:true,executablePath:settings({}).executablePath});
let ui;
try {
 const page=await browser.newPage();await page.setViewport({width:360,height:480,deviceScaleFactor:2/3});
 const url=`http://127.0.0.1:${server.address().port}/game`;
 await page.goto(url);
 ui=await managedCydUI(page,{pixsimURL:url,compact:true,width:240,height:320,viewWidth:360,viewHeight:480});
 const check=async()=>{
   await page.waitForSelector('#cyd-mic');
   await page.waitForFunction(()=>!!document.querySelector('#cyd-presence-style'));
   assert.equal(await page.$eval('.game-chat-column',n=>getComputedStyle(n).display),'none');
   assert.equal(await page.$eval('[aria-label="Open group chat"]',n=>getComputedStyle(n).display),'none');
   assert.equal(await page.$eval('[data-slot-idx="3"]',n=>getComputedStyle(n).visibility),'visible');
   assert.equal(await page.$$eval('#cyd-mic',nodes=>nodes.length),1);
 };
 await check();
 await page.reload({waitUntil:'domcontentloaded'});await check();
 await page.goto(url+'?next=1',{waitUntil:'domcontentloaded'});await check();
 await page.evaluate(()=>document.querySelectorAll('style[id^="cyd-"]').forEach(n=>n.remove()));
 await page.waitForSelector('#cyd-compact-style');await check();
 assert.ok(ui.getStats().uiInstalls>=4);
 await page.setViewport({width:800,height:600,deviceScaleFactor:1,hasTouch:true});
 await page.waitForFunction(()=>innerWidth===360 && innerHeight===480 && Math.abs(devicePixelRatio-2/3)<.001,{timeout:5000});
 await check();
 ui.stop();ui=undefined;
 await page.reload({waitUntil:'domcontentloaded'});
 assert.equal(await page.$('#cyd-mic'),null);
 console.log('PASS: compact HUD survives reload/navigation and repairs removed styles; one mic, hidden text chat, visible action, clean listener shutdown.');
}finally{ui?.stop();await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
