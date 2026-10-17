import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import { settings } from '../server/render.mjs';
import { worldView } from '../server/world-view.mjs';
const browser = await puppeteer.launch({headless:true, executablePath:settings({}).executablePath});
try {
  const page = await browser.newPage();
  await page.setViewport({width:360,height:480,deviceScaleFactor:2/3});
  await page.setContent('<div id="game-container"><canvas></canvas></div><button id="fixed-ui" style="position:fixed;bottom:3px">Control</button>');
  await page.evaluate(() => {
    const scene = {updateMgr:{updateCamera(){scene.cameras.main.scrollY=200}},cameras:{main:{zoom:1,width:360,scrollX:125,scrollY:0}},setZoom(value){scene.cameras.main.zoom=value},events:{on(){},off(){}},chatBubbleManager:{bubbles:Array.from({length:6},(_,i)=>({container:{visible:true,scene:true,setVisible(value){this.visible=value}},nameLabel:{text:`Speaker ${i}`},message:{text:'A long fixture message. '.repeat(20)}}))}};
    window.__PIXSIM_GAME__ = {canvas:document.querySelector('canvas'),scene:{getScene:()=>scene}};
  });
  const uiBefore = await page.$eval('#fixed-ui', n=>n.getBoundingClientRect().top);
  const stats = await worldView(page);
  assert.equal(stats.zoom,1.1);
  assert.equal(stats.offsetY,-52);
  const scroll = await page.evaluate(()=>{const scene=window.__PIXSIM_GAME__.scene.getScene();scene.updateMgr.updateCamera();return scene.cameras.main.scrollY});
  assert.equal(await page.evaluate(()=>window.__PIXSIM_GAME__.scene.getScene().cameras.main.zoom),1.1);
  assert.equal(await page.evaluate(()=>window.__PIXSIM_GAME__.scene.getScene().cameras.main.scrollX),125,'Horizontal camera framing remains unchanged');
  assert.ok(scroll < 150 && scroll > 145, 'Camera scroll shifts scenery down without moving DOM UI');
  assert.equal(await page.$eval('#fixed-ui', n=>n.getBoundingClientRect().top),uiBefore);
  const box = await page.$eval('#cyd-speech', n => {const r=n.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,height:r.height,scroll:n.scrollHeight>n.clientHeight}});
  assert.ok(box.top >= 0 && box.bottom * 2/3 <= 112.01 && box.right <= 360, 'Speech stays within top35% of240x320');
  assert.ok(box.scroll, 'Extra bubbles scroll instead of covering the game');
  assert.ok(await page.$eval('#cyd-speech p', n => parseFloat(getComputedStyle(n).fontSize)) < 27, 'Speech font is smaller');
  assert.equal(await page.$$eval('#cyd-speech p', nodes => nodes.filter(n => !n.hidden).length), 1);
  await page.evaluate(() => window.__cydWorldCleanup());
  assert.equal(await page.$('#cyd-speech'), null);
  console.log('PASS: compact speech, top35% cap, overflow scrolling, one expanded bubble and cleanup.');
} finally {await browser.close();}
