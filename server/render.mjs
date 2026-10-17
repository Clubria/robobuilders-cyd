import puppeteer from 'puppeteer';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { prepareCompact, compactUi } from './compact.mjs';
import { prepareWorldView } from './world-view.mjs';
import { prepareClubria } from './clubria.mjs';

const macChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function settings(env = process.env) {
  const integer = (name, fallback, min, max) => {
    const value = Number(env[name] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${name} must be an integer from ${min} to ${max}`);
    }
    return value;
  };
  const source = env.FRAME_SOURCE ?? 'test';
  if (!['test', 'pixsim', 'clubria'].includes(source)) throw new Error('FRAME_SOURCE must be test, pixsim or clubria');
  const pixsimURL = env.PIXSIM_URL ?? 'http://localhost:4736/';
  const pageURL = source === 'clubria' ? env.CLUBRIA_URL ?? 'https://aibuilders.club/e/AMS-Oct21/timer?record=1&cyd=mini' : pixsimURL;
  const url = new URL(pageURL);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Page URL must be HTTP(S)');
  if (source === 'clubria' && (env.CYD_PORTRAIT === '1' || env.CYD_COMPACT === '1' || env.CYD_CONTROLS === '1')) {
    throw new Error('Clubria must not use Pixsim HUD or game controls');
  }
  const width = integer('WIDTH', 320, 64, 800);
  const height = integer('HEIGHT', 240, 64, 800);
  const viewWidth = integer('VIEW_WIDTH', width, width, 1600);
  const viewHeight = integer('VIEW_HEIGHT', height, height, 1600);
  if (viewWidth * height !== viewHeight * width) throw new Error('Browser view and output must have the same aspect ratio');
  const captureMode = env.CAPTURE_MODE ?? 'screenshot';
  if (!['screenshot', 'screencast'].includes(captureMode)) throw new Error('CAPTURE_MODE must be screenshot or screencast');
  return {
    source, pixsimURL, pageURL, touchInput: source === 'clubria', live: env.STREAM === '1', latchControls: env.CYD_CONTROLS === '1', portraitUi: env.CYD_PORTRAIT === '1',
    compact: env.CYD_COMPACT === '1',
    // Fixed project-local isolated profile; never reuse a personal browser profile.
    cacheDir: env.CYD_COMPACT === '1' && env.CYD_CACHE === '1'
      ? resolve('artifacts/browser-cache/cyd-compact', createHash('sha256').update(url.origin).digest('hex').slice(0, 16)) : undefined,
    captureMode,
    fps: integer('FPS', 4, 1, 60),
    width, height, viewWidth, viewHeight,
    quality: integer('JPEG_QUALITY', 70, 10, 95),
    port: integer('PORT', 3088, 1, 65535),
    waitMs: integer('CAPTURE_WAIT_MS', 5000, 0, 30000),
    executablePath: env.CHROME_PATH || (process.platform === 'darwin' && existsSync(macChrome) ? macChrome : undefined),
  };
}

export async function openPage(config) {
  // Use an isolated profile, never the user's logged-in browser/profile.
  const browser = await puppeteer.launch({
    headless: true, executablePath: config.executablePath,
    ...(config.cacheDir ? { userDataDir: config.cacheDir } : {}),
  });
  try {
    const page = await browser.newPage();
    // Chromium downscales the complete logical view directly to the screen-sized JPEG.
    await page.setViewport({ width: config.viewWidth ?? config.width, height: config.viewHeight ?? config.height,
      deviceScaleFactor: config.width / (config.viewWidth ?? config.width), hasTouch: true, isMobile: config.source === 'clubria' });
    if (config.source === 'pixsim' || config.source === 'clubria') {
      if (config.source === 'clubria') await prepareClubria(page, new URL(config.pageURL).origin);
      if (config.portraitUi) await prepareWorldView(page, new URL(config.pixsimURL).origin);
      if (config.compact) await prepareCompact(page, new URL(config.pixsimURL).origin);
      const response = await page.goto(config.pageURL ?? config.pixsimURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      assertNavigation(response);
      // Game assets/WebGL need time after DOM readiness; still a one-time capture.
      await new Promise(resolve => setTimeout(resolve, config.waitMs));
      if (config.compact) await compactUi(page);
    } else {
      await page.setContent(`<!doctype html><html><style>*{box-sizing:border-box}body{margin:0;background:#101827;color:white;font:16px system-ui;height:100vh;display:flex;flex-direction:column}.bars{height:30px;display:flex}.bars i{flex:1}main{flex:1;padding:16px;border:4px solid white;border-top:0}h1{font-size:28px;margin:0 0 6px}p{margin:6px 0}.grid{height:40px;margin-top:12px;background:repeating-linear-gradient(90deg,#fff 0 10px,#101827 10px 20px)}small{font-size:12px}</style><div class="bars"><i style="background:#f00"></i><i style="background:#0f0"></i><i style="background:#00f"></i><i style="background:#ff0"></i><i style="background:#0ff"></i><i style="background:#f0f"></i></div><main><h1>HELLO CYD</h1><p>Mac → Wi-Fi → screen</p><p>${config.width} × ${config.height} / single JPEG</p><div class="grid"></div><small>White border = full image visible</small></main></html>`);
    }
    return { browser, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export function assertNavigation(response) {
  if (!response || !response.ok()) {
      throw new Error(`Page navigation failed (HTTP ${response?.status() ?? 'no response'})`);
  }
}

export async function renderFrame(config) {
  const { browser, page } = await openPage(config);
  try {
    return Buffer.from(await page.screenshot({ type: 'jpeg', quality: config.quality }));
  } finally {
    await browser.close();
  }
}
