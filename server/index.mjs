import { networkInterfaces } from 'node:os';
import { createBridge } from './bridge.mjs';
import { renderFrame, settings } from './render.mjs';
import { liveCapture } from './capture.mjs';
import { readFile } from 'node:fs/promises';

const config = settings();
const interfaces = networkInterfaces();
const allowedHosts = ['localhost', '127.0.0.1', '[::1]', ...Object.values(interfaces)
  .flatMap(entries => (entries ?? []).filter(entry => entry.family === 'IPv4').map(entry => entry.address))];
const capture = config.live ? await liveCapture(config) : null;
const frame = capture ? undefined : await renderFrame(config);
const bundle = await readFile(new URL('../artifacts/downloads/cyd-bridge.zip', import.meta.url)).catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return undefined;
});
const server = createBridge({ frame, ...config, ...capture, bundle, allowedHosts });
let closing;
const shutdown = () => closing ??= (async () => {
  server.close();
  server.closeAllConnections();
  await capture?.close();
})();
server.on('error', error => { console.error(error.message); process.exitCode = 1; void shutdown(); });
server.listen(config.port, '0.0.0.0', () => {
  console.log(`${config.live ? `Live ${config.source}` : 'Single-image'} server: http://localhost:${config.port}/preview`);
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        console.log(`Possible board URL (choose the Wi-Fi/LAN IP): http://${entry.address}:${config.port}/`);
      }
    }
  }
  console.log(`Frames: ${config.width}x${config.height}. ${config.live ? `Target ${config.fps} FPS; preview controls enabled.` : 'Single image only.'} Physical CYD not verified.`);
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => { void shutdown(); });
}
