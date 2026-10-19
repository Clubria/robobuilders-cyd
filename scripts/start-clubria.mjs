// Environment setup that works in both macOS shells and Windows PowerShell.
Object.assign(process.env, {
  FRAME_SOURCE: 'clubria', STREAM: '1', CAPTURE_MODE: 'screenshot',
  WIDTH: '240', HEIGHT: '320', VIEW_WIDTH: '240', VIEW_HEIGHT: '320',
  JPEG_QUALITY: '65', FPS: '3', CAPTURE_WAIT_MS: '3000',
});
await import('../server/index.mjs');
