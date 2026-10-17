import { CDPSessionEvent } from 'puppeteer';

// Chrome pushes compressed frames; no per-frame screenshot round trip or frame queue.
export async function screencastCapture({ session, fps, width, height, quality, initialFrame, now = () => performance.now() }) {
  let frame = { buffer: initialFrame, sequence: 1, capturedAt: new Date().toISOString() };
  const stats = { capturedFrames: 1, screencastFrames: 0, captureErrors: 0, lastCaptureError: null };
  const interval = 1000 / fps;
  let nextDue = -Infinity, stopped = false;
  const failed = () => {
    if (!stopped) { stats.captureErrors++; stats.lastCaptureError = 'Chrome screencast failed; check frame freshness'; }
  };
  const receive = event => {
    // ACK even discarded frames; otherwise Chromium eventually stops producing them.
    void session.send('Page.screencastFrameAck', { sessionId: event.sessionId }).catch(failed);
    if (stopped) return;
    stats.screencastFrames++;
    const at = now();
    if (at < nextDue) return;
    const buffer = Buffer.from(event.data, 'base64');
    if (buffer.length < 4 || buffer.length > 65536 || buffer.readUInt16BE(0) !== 0xffd8 || buffer.readUInt16BE(buffer.length - 2) !== 0xffd9) {
      failed(); return;
    }
    nextDue = nextDue === -Infinity || at - nextDue >= interval ? at + interval : nextDue + interval;
    frame = { buffer, sequence: frame.sequence + 1, capturedAt: new Date().toISOString() };
    stats.capturedFrames++;
    stats.lastCaptureError = null;
  };
  session.on('Page.screencastFrame', receive);
  session.on(CDPSessionEvent.Disconnected, failed);
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    session.off('Page.screencastFrame', receive);
    session.off(CDPSessionEvent.Disconnected, failed);
    try { await session.send('Page.stopScreencast'); } catch { /* Browser may already be closed. */ }
    try { await session.detach(); } catch { /* Session may already be detached. */ }
  };
  try {
    await session.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: width, maxHeight: height, everyNthFrame: 1 });
  } catch (error) { await stop(); throw error; }
  return {
    getFrame: () => frame,
    getStats: () => ({ ...stats, captureMode: 'screencast', captureMs: null }),
    stop,
  };
}
