import { openPage } from './render.mjs';
import { inputController } from './input.mjs';
import { installLatch } from './latch.mjs';
import { screencastCapture } from './screencast.mjs';
import { managedCydUI } from './cyd-ui.mjs';

// One capture at a time, shared by every client. Slow capture never builds a queue.
export function captureLoop({ capture, fps, initialFrame }) {
  let frame = { buffer: initialFrame, sequence: 1, capturedAt: new Date().toISOString() };
  const stats = { capturedFrames: 1, captureMs: 0, captureErrors: 0, lastCaptureError: null };
  let stopped = false;
  let timer;
  let pending = Promise.resolve();
  const tick = () => {
    pending = (async () => {
      const started = performance.now();
      try {
        const buffer = await capture();
        if (!stopped) {
          frame = { buffer, sequence: frame.sequence + 1, capturedAt: new Date().toISOString() };
          stats.capturedFrames++;
          stats.lastCaptureError = null;
        }
      } catch {
        if (!stopped) {
          stats.captureErrors++;
          stats.lastCaptureError = 'Capture failed; serving last successful frame';
        }
      } finally {
        stats.captureMs = Math.round(performance.now() - started);
        if (!stopped) timer = setTimeout(tick, Math.max(10, 1000 / fps - stats.captureMs));
      }
    })();
  };
  timer = setTimeout(tick, 1000 / fps);
  return {
    getFrame: () => frame,
    getStats: () => ({ ...stats }),
    stop: async () => { stopped = true; clearTimeout(timer); await pending; },
  };
}

export async function liveCapture(config) {
  const { browser, page } = await openPage(config);
  const capture = async () => Buffer.from(await page.screenshot({ type: 'jpeg', quality: config.quality }));
  let loop, controls, ui;
  try {
    controls = inputController(page, config);
    if (config.portraitUi) ui = await managedCydUI(page, config);
    if (config.latchControls && !config.portraitUi) await installLatch(page, controls);
    const initialFrame = await capture();
    loop = config.captureMode === 'screencast'
      ? await screencastCapture({ session: await page.createCDPSession(), fps: config.fps,
        width: config.width, height: config.height, quality: config.quality, initialFrame })
      : captureLoop({ capture, fps: config.fps, initialFrame });
    return {
      ...loop,
      input: controls.input,
      heartbeat: controls.heartbeat,
      getStats: () => ({ ...loop.getStats(), ...controls.getStats(), ...ui?.getStats(), viewWidth: config.viewWidth, viewHeight: config.viewHeight,
        captureMode: config.captureMode, compactEnabled: !!config.compact, persistentCache: !!config.cacheDir, jpegQuality: config.quality }),
      close: async () => {
        ui?.stop();
        // Closing the browser interrupts a wedged capture, allowing stop to finish.
        const stopping = loop.stop();
        const stoppingControls = controls.stop();
        await browser.close();
        await stoppingControls;
        await stopping;
      },
    };
  } catch (error) {
    ui?.stop();
    const stoppingControls = controls?.stop();
    await browser.close();
    await stoppingControls;
    await loop?.stop();
    throw error;
  }
}
