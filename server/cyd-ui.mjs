import { compactUi } from './compact.mjs';
import { portraitUI } from './portrait.mjs';
import { worldView } from './world-view.mjs';
import { presenceUI } from './presence.mjs';
import { compactWeather } from './weather.mjs';

// A game navigation replaces the document, not the Puppeteer Page. Reinstall the
// CYD adaptations on each document, and repair missing styles after head resets.
export async function managedCydUI(page, config) {
  const origin = new URL(config.pixsimURL).origin;
  const stats = { uiInstalls: 0, uiErrors: 0 };
  const expected = config.width && config.height && config.viewWidth && config.viewHeight
    ? {width:config.viewWidth,height:config.viewHeight,deviceScaleFactor:config.width/config.viewWidth,hasTouch:true} : null;
  let stopped = false, installing;
  const allowed = () => { try { return new URL(page.url()).origin === origin; } catch { return false; } };
  const install = () => {
    if (stopped || !allowed()) return Promise.resolve();
    if (installing) return installing;
    installing = (async () => {
      if (expected) {
        const actual = await page.evaluate(() => ({width:innerWidth,height:innerHeight,ratio:devicePixelRatio}));
        if (actual.width !== expected.width || actual.height !== expected.height || Math.abs(actual.ratio - expected.deviceScaleFactor) > .001) await page.setViewport(expected);
      }
      if (config.compact) {
        await page.evaluate(() => document.querySelector('#cyd-compact-style')?.remove());
        await compactUi(page);
      }
      await portraitUI(page);
      await worldView(page);
      await presenceUI(page);
      if (config.compact) await compactWeather(page);
      stats.uiInstalls++;
    })().finally(() => { installing = undefined; });
    return installing;
  };
  const repair = () => { void install().catch(() => { if (!stopped) stats.uiErrors++; }); };
  page.on('domcontentloaded', repair);
  let checking = false;
  const timer = setInterval(async () => {
    if (stopped || checking || installing || !allowed()) return;
    checking = true;
    try {
      const intact = await page.evaluate(({compact,expected}) => (!expected || (innerWidth===expected.width && innerHeight===expected.height && Math.abs(devicePixelRatio-expected.deviceScaleFactor)<.001)) && !!document.querySelector('#cyd-portrait-style')
        && !!document.querySelector('#cyd-world-style') && !!document.querySelector('#cyd-presence-style')
        && !!document.querySelector('#cyd-mic') && (!compact || (!!document.querySelector('#cyd-compact-style') && !!window.__cydWeatherStats)), {compact:config.compact,expected});
      if (!intact && !stopped) await install();
    } catch { if (!stopped) stats.uiErrors++; }
    finally { checking = false; }
  }, 1000);
  timer.unref?.();
  const stop = () => { stopped = true; clearInterval(timer); page.off('domcontentloaded', repair); };
  try { await install(); } catch (error) { stop(); throw error; }
  return { getStats: () => ({...stats}), stop };
}
