import { createServer } from 'node:http';
import { preview } from './preview.mjs';
import { guide } from './guide.mjs';

// Wire format matches SharkSharp/cyd-browser's GET / JPEG transport.
export function createBridge({ frame, width, height, source, live = false, fps = 4, getFrame, getStats = () => ({}), input, heartbeat, bundle, allowedHosts = ['localhost', '127.0.0.1', '[::1]'] }) {
  const current = getFrame ?? (() => ({ buffer: frame, sequence: 1 }));
  const status = {
    mode: live ? 'live-stream' : 'single-image', width, height, source,
    targetFps: live ? fps : 0, streamClients: 0, imageRequests: 0, lastImageRequest: null,
  };
  const recordRequest = req => {
    if (req.headers['x-input-source'] === 'usb') heartbeat?.('usb');
    status.imageRequests++;
    status.lastImageRequest = {
      at: new Date().toISOString(), address: req.socket.remoteAddress,
      userAgent: String(req.headers['user-agent'] ?? '').slice(0, 200),
    };
  };
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Reject rebinding domains even when an attacker supplies matching Origin/Host.
    const port = server.address()?.port;
    if (!allowedHosts.some(host => req.headers.host === `${host}:${port}` || (port === 80 && req.headers.host === host))) {
      res.writeHead(421); res.end('Host not allowed'); return;
    }
    let path;
    try { path = new URL(req.url, 'http://localhost').pathname; }
    catch { res.writeHead(400); res.end('Invalid URL'); return; }
    if (req.method === 'GET' && path === '/cyd') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(guide);
    } else if (req.method === 'GET' && path === '/cyd/download.zip') {
      if (!bundle) { res.writeHead(503); res.end('Download not built yet. Run pnpm package:bridge.'); return; }
      res.writeHead(200, { 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="cyd-bridge.zip"', 'Content-Length': bundle.length }); res.end(bundle);
    } else if (req.method === 'GET' && (path === '/' || path === '/frame.jpg')) {
      recordRequest(req);
      const { buffer, sequence, capturedAt } = current();
      const age = capturedAt ? Math.max(0, Date.now() - Date.parse(capturedAt)) : null;
      res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': buffer.length, 'X-Frame-Sequence': sequence,
        ...(Number.isFinite(age) ? { 'X-Frame-Age-Ms': age } : {}) });
      res.end(buffer);
    } else if (req.method === 'GET' && path === '/stream.mjpg' && live) {
      if (status.streamClients >= 4) { res.writeHead(503); res.end('Too many stream clients'); return; }
      status.streamClients++;
      recordRequest(req);
      res.writeHead(200, { 'Content-Type': 'multipart/x-mixed-replace; boundary=cydframe' });
      let previous = -1;
      const send = () => {
        if (res.destroyed || res.writableNeedDrain) return;
        const { buffer, sequence } = current();
        if (previous === sequence) return;
        previous = sequence;
        // One write per complete part; skip frames instead of buffering for slow clients.
        res.write(Buffer.concat([Buffer.from(`--cydframe\r\nContent-Type: image/jpeg\r\nContent-Length: ${buffer.length}\r\nX-Frame-Sequence: ${sequence}\r\n\r\n`), buffer, Buffer.from('\r\n')]));
      };
      const timer = setInterval(send, 1000 / fps);
      res.once('close', () => { clearInterval(timer); status.streamClients--; });
      send();
    } else if (req.method === 'GET' && path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const latest = current();
      res.end(JSON.stringify({ ok: true, ...status, frameBytes: latest.buffer.length, frameSequence: latest.sequence,
        capturedAt: latest.capturedAt ?? null, frameAgeMs: latest.capturedAt ? Math.max(0, Date.now() - Date.parse(latest.capturedAt)) : null, ...getStats() }));
    } else if (req.method === 'GET' && path === '/preview') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(preview({ live, width, height }));
    } else if (req.method === 'POST' && path === '/input' && live && input) {
      try {
        // Block cross-origin browser writes, including requests from unrelated LAN pages.
        if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) {
          throw Object.assign(new Error('Cross-origin input denied'), { statusCode: 403 });
        }
        if (req.headers['content-type'] !== 'application/json') {
          throw Object.assign(new Error('Expected application/json'), { statusCode: 415 });
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk.toString();
          if (body.length > 1024) throw Object.assign(new Error('Input too large'), { statusCode: 413 });
        }
        let command;
        try { command = JSON.parse(body); } catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
        if (!validInput(command, width, height)) throw Object.assign(new Error('Invalid input'), { statusCode: 400 });
        const source = req.headers['x-input-source'] ?? 'legacy';
        if (!['legacy', 'usb', 'preview', 'cyd'].includes(source)) throw Object.assign(new Error('Invalid input source'), { statusCode: 400 });
        await input(command, source);
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}');
      } catch (error) {
        if (!res.destroyed) {
          res.writeHead(error.statusCode ?? 503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.statusCode ? error.message : 'Browser input unavailable' }));
        }
      }
    } else if (req.method === 'PUT' && path === '/') {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Board touch protocol is not enabled; use the browser preview controls.' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });
  return server;
}

export function validInput(command, width, height) {
  if (!command || typeof command !== 'object') return false;
  if (command.action === 'pointer') {
    if (command.phase === 'cancel') return true;
    return ['down', 'move', 'up'].includes(command.phase)
      && Number.isInteger(command.x) && Number.isInteger(command.y)
      && command.x >= 0 && command.x < width && command.y >= 0 && command.y < height;
  }
  if (command.action === 'tap') return Number.isInteger(command.x) && Number.isInteger(command.y)
    && command.x >= 0 && command.x < width && command.y >= 0 && command.y < height;
  return command.action === 'key' && (command.phase === undefined || ['down', 'up'].includes(command.phase))
    && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'Enter', 'Escape', 'w', 'a', 's', 'd'].includes(command.key);
}
