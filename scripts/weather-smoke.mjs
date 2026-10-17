import assert from 'node:assert/strict';
import puppeteer from 'puppeteer';
import {settings} from '../server/render.mjs';
import {compactWeather} from '../server/weather.mjs';
const browser=await puppeteer.launch({headless:true,executablePath:settings({}).executablePath});
try {
 const page=await browser.newPage();await page.setContent('<p>Weather fixture</p>');
 await page.evaluate(()=>{
   const weather={outdoorVisible:true,wetRain:1.5,setOutdoorVisible(visible){this.outdoorVisible=visible}};
   window.weatherFixture=weather;window.__PIXSIM_GAME__={scene:{getScene:()=>({layerMgr:{dayNightWeather:weather}})}};
 });
 await compactWeather(page);
 assert.equal(await page.evaluate(()=>window.__cydWeatherStats.visualsDisabled),true);
 assert.equal(await page.evaluate(()=>window.weatherFixture.outdoorVisible),false);
 await page.evaluate(()=>window.weatherFixture.setOutdoorVisible(true));
 assert.equal(await page.evaluate(()=>window.weatherFixture.outdoorVisible),false,'Native outdoor transitions must not re-enable effects');
 assert.equal(await page.evaluate(()=>window.weatherFixture.wetRain),1.5,'Gameplay rain value is not altered');
 await page.evaluate(()=>window.__cydWeatherCleanup());
 assert.equal(await page.evaluate(()=>window.weatherFixture.outdoorVisible),true,'Cleanup restores native visibility');
 console.log('PASS: native weather visuals disabled, outdoor transitions constrained, gameplay weather unchanged, cleanup restored.');
}finally{await browser.close()}
