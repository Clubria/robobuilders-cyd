// Native mouse gestures support both Pixsim pointer controls and HTML drag/drop.
// Coalesce only consecutive moves. Never drop down/up/cancel or synthesize a click on up.
export function inputController(page, { width, height, viewWidth = width, viewHeight = height, touchInput = false }) {
  // Real touch gestures scroll native mobile pages; Pixsim keeps mouse gestures.
  let touchPoint, touchDown = false;
  const pointer = touchInput ? {
    move: async (x, y) => { touchPoint = { x, y }; if (touchDown) await page.touchscreen.touchMove(x, y); },
    down: async () => { await page.touchscreen.touchStart(touchPoint.x, touchPoint.y); touchDown = true; },
    up: async () => { if (touchDown) await page.touchscreen.touchEnd(); touchDown = false; },
    click: async (x, y) => { touchPoint = { x, y }; await page.touchscreen.tap(x, y); },
  } : page.mouse;
  const queue = [];
  const keys = new Map();
  const stats = { inputCount: 0, inputErrors: 0, coalescedMoves: 0, inputLatencyMs: 0, pointerHeld: false };
  let running = false, stopped = false, owner = null, lastInput = 0;
  let draining = Promise.resolve(), stopping;
  const point = command => ({ x: command.x * viewWidth / width, y: command.y * viewHeight / height });
  let lastPoint;
  const movePointer = async p => {
    // A redundant CDP move on every release can consume the native double-tap
    // time budget under rendering load. Preserve real samples, skip equal points.
    if (lastPoint?.x === p.x && lastPoint?.y === p.y) return;
    await pointer.move(p.x, p.y);
    lastPoint = p;
  };
  const fail = (message, statusCode = 409) => Object.assign(new Error(message), { statusCode });
  async function clearKeys(source) {
    for (const [key, state] of keys) {
      if (state.source === source) { await page.keyboard.up(key); keys.delete(key); }
    }
  }
  async function showLatch(direction) {
    if (page.evaluate) await page.evaluate(value => window.__cydSetLatch?.(value), direction);
  }
  async function apply(command, source) {
    if (command.action === 'pointer' && command.phase === 'cancel') {
      if (owner === source) { await pointer.up(); owner = null; }
      await clearKeys(source);
      if (source === 'usb') await showLatch(0);
      stats.pointerHeld = owner !== null;
      return;
    }
    if (command.action === 'latch') {
      const requestedKey = command.direction < 0 ? 'ArrowLeft' : 'ArrowRight';
      if (command.direction && keys.has(requestedKey) && keys.get(requestedKey).source !== source) {
        throw fail('Key is held by another input client');
      }
      await clearKeys(source);
      if (command.direction) {
        const key = command.direction < 0 ? 'ArrowLeft' : 'ArrowRight';
        await page.keyboard.down(key);
        keys.set(key, { source, at: performance.now() });
      }
      await showLatch(command.direction);
      return;
    }
    if (command.action === 'key' && command.phase === 'up') {
      if (keys.get(command.key)?.source === source) { await page.keyboard.up(command.key); keys.delete(command.key); }
      return;
    }
    if (owner && owner !== source) throw fail('Pointer is held by another input client');
    if (command.action === 'pointer') {
      if (command.phase === 'cancel') {
        if (owner) await pointer.up();
        owner = null;
        await clearKeys(source);
        await showLatch(0);
      } else if (command.phase === 'down') {
        if (owner) await pointer.up();
        const p = point(command);
        await movePointer(p);
        await pointer.down();
        owner = source;
      } else if (owner) {
        const p = point(command);
        // Physical samples already provide the drag path; don't synthesize an
        // intermediate CDP mouse event for every incoming move/up.
        await movePointer(p);
        if (command.phase === 'up') { await pointer.up(); owner = null; }
      }
      lastInput = performance.now();
    } else if (command.action === 'tap') {
      if (owner) { await pointer.up(); owner = null; }
      const p = point(command);
      await pointer.click(p.x, p.y);
      lastPoint = p;
    } else {
      const existing = keys.get(command.key);
      if (existing && existing.source !== source) throw fail('Key is held by another input client');
      if (command.phase === 'down') {
        if (!existing) await page.keyboard.down(command.key);
        keys.set(command.key, { source, at: performance.now() });
      } else await page.keyboard.press(command.key, { delay: 40 });
    }
    stats.pointerHeld = owner !== null;
  }
  async function drain() {
    if (running) return;
    running = true;
    while (queue.length && !stopped) {
      const item = queue.shift();
      try {
        await apply(item.command, item.source);
        stats.inputCount++;
        stats.inputLatencyMs = Math.round(performance.now() - item.at);
        item.resolve();
      } catch (error) {
        stats.inputErrors++;
        item.reject(error);
      }
    }
    running = false;
  }
  function push(command, source = 'legacy') {
    if (stopped) return Promise.reject(fail('Input stopped', 503));
    const tail = queue.at(-1);
    if (command.action === 'pointer' && command.phase === 'move'
      && tail?.source === source && tail.command.action === 'pointer' && tail.command.phase === 'move') {
      tail.resolve(); // Replaced move is accepted, not queued indefinitely.
      stats.coalescedMoves++;
      queue.pop();
    }
    const terminal = (command.action === 'pointer' && ['up', 'cancel'].includes(command.phase))
      || (command.action === 'key' && command.phase === 'up');
    if (terminal) {
      const existing = queue.at(-1);
      // Only adjacent duplicate releases are equivalent. up/down/up must stay distinct.
      if (existing?.source === source && existing.command.action === command.action
        && existing.command.phase === command.phase && existing.command.key === command.key) return existing.promise;
    }
    // Four validated sources and eleven allowed keys fit the reserved release capacity.
    if (queue.length >= (terminal ? 96 : 32)) return Promise.reject(fail('Input busy', 429));
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    queue.push({ command, source, at: performance.now(), resolve, reject, promise });
    if (!running) draining = drain();
    return promise;
  }
  const watchdog = setInterval(() => {
    if (owner && performance.now() - lastInput > 5000) {
      void push({ action: 'pointer', phase: 'cancel' }, owner).catch(() => {});
    }
    for (const [key, state] of keys) {
      if (performance.now() - state.at > 5000) {
        void push({ action: 'key', phase: 'up', key }, state.source).catch(() => {});
      }
    }
  }, 500);
  watchdog.unref();
  return {
    input: push,
    latch: direction => push({ action: 'latch', direction }, 'usb'),
    heartbeat: source => { for (const state of keys.values()) if (state.source === source) state.at = performance.now(); },
    getStats: () => ({ ...stats, inputQueue: queue.length, heldKeys: [...keys.keys()] }),
    stop: () => {
      if (stopping) return stopping;
      stopped = true; clearInterval(watchdog);
      for (const item of queue.splice(0)) item.reject(fail('Input stopped', 503));
      stopping = (async () => {
        await draining;
        try { if (owner) await pointer.up(); } catch { /* Browser may already have closed. */ }
        for (const key of keys.keys()) { try { await page.keyboard.up(key); } catch {} }
        keys.clear(); owner = null; stats.pointerHeld = false;
      })();
      return stopping;
    },
  };
}
