// Discover the game only inside this isolated CYD context, before Phaser boots.
export async function prepareWorldView(page, origin) {
  await page.evaluateOnNewDocument(expected => {
    if (location.origin !== expected) return;
    const markReceiver = () => document.documentElement.setAttribute('data-cyd-view', '');
    if (document.documentElement) markReceiver();
    else document.addEventListener('DOMContentLoaded', markReceiver, { once: true });
    const instrument = Phaser => {
      const proto = Phaser?.Game?.prototype;
      if (!proto || proto.__cydCapture) return;
      proto.__cydCapture = true;
      for (const method of ['boot', 'start']) {
        const original = proto[method];
        if (typeof original !== 'function') continue;
        proto[method] = function (...args) { window.__cydCapturedGame = this; return Reflect.apply(original, this, args); };
      }
    };
    if (window.Phaser) instrument(window.Phaser);
    else {
      let value;
      Object.defineProperty(window, 'Phaser', { configurable: true, enumerable: true,
        get: () => value, set: Phaser => { value = Phaser; instrument(Phaser); } });
    }
  }, origin);
}

export async function worldView(page, options = {}) {
  return page.evaluate(({ zoom = 1.1, offsetY = -52, nameFont = 24, bubbleFont = 23, bubbleHeight = 108 } = {}) => {
    window.__cydWorldCleanup?.();
    const ratio = devicePixelRatio || 1, px = physical => `${Math.round(physical / ratio * 1000) / 1000}px`;
    const stats = window.__cydWorldStats = { attached: false, cameraApplied: false, names: 0, bubbles: 0, zoom, offsetY };
    const layer = document.createElement('section'); layer.id = 'cyd-speech'; layer.setAttribute('aria-label', 'Conversation');
    layer.style.cssText = `position:fixed;left:${px(42)};top:${px(4)};width:${px(192)};max-height:${px(bubbleHeight)};overflow:auto;overscroll-behavior:contain;scrollbar-width:none;z-index:2147483644;touch-action:none;display:none;box-sizing:border-box`;
    const style = document.createElement('style'); style.id = 'cyd-world-style';
    const lineHeight = Math.ceil(bubbleFont * ratio / 2) * 2 + 2;
    style.textContent = `#cyd-speech article{box-sizing:border-box;width:100%;margin:0 0 ${px(3)};padding:${px(4)};border:${px(1)} solid #587b99;border-radius:${px(5)};background:#102030f7;color:#f1f7ff;overflow-wrap:anywhere;word-break:normal}#cyd-speech header button{display:flex;justify-content:space-between;align-items:center;width:100%;min-height:${px(22)};padding:0;border:0;background:none;text-align:left;font:${px(12)}/${px(16)} system-ui;font-weight:600;color:#a8d8ff}#cyd-speech p{font:${bubbleFont}px/${px(lineHeight)} Arial,sans-serif;margin:${px(2)} 0 0;white-space:pre-wrap;overflow:auto;scrollbar-width:thin;touch-action:none}#cyd-speech p[hidden]{display:none}`;
    document.head.append(style); document.body.append(layer);
    let scrollStart;
    layer.onpointerdown = e => {
      e.stopPropagation();
      if (e.target.closest('button')) return;
      const target = e.target.closest('p') ?? layer;
      scrollStart = { target, y: e.clientY, top: target.scrollTop }; layer.setPointerCapture(e.pointerId); e.preventDefault();
    };
    layer.onpointermove = e => { if (scrollStart) { scrollStart.target.scrollTop = scrollStart.top + scrollStart.y - e.clientY; e.preventDefault(); e.stopPropagation(); } };
    layer.onpointerup = layer.onpointercancel = e => { scrollStart = null; e.stopPropagation(); };
    let attachedScene, attachedManager, restoreScene = () => {}, expanded, previousNewest;
    const cards = new Map();
    const renderSpeech = bubbles => {
      const newest = bubbles.at(-1)?.container;
      const newMessage = newest !== previousNewest;
      if (!expanded || expanded === previousNewest || !bubbles.some(b => b.container === expanded)) expanded = newest;
      previousNewest = newest;
      const height = Math.min(bubbleHeight, Math.floor(innerHeight * ratio * .35) - 4);
      if (layer.style.maxHeight !== px(height)) layer.style.maxHeight = px(height);
      const bodyHeight = Math.max(lineHeight, Math.floor((height - 36) / lineHeight) * lineHeight);
      for (const [container, card] of cards) if (!bubbles.some(b => b.container === container)) { card.article.remove(); cards.delete(container); }
      for (const bubble of bubbles) {
        let card = cards.get(bubble.container);
        if (!card) {
          const article = document.createElement('article'), header = document.createElement('header'), button = document.createElement('button'), p = document.createElement('p');
          button.type = 'button';
          button.onclick = () => { expanded = bubble.container; renderSpeech(attachedScene?.chatBubbleManager?.bubbles ?? []); };
          header.append(button); article.append(header, p); layer.append(article);
          card = { article, button, p }; cards.set(bubble.container, card);
        }
        const active = bubble.container === expanded;
        const title = `${bubble.nameLabel?.text ?? 'Message'} ${active ? '−' : '+'}`;
        if (card.button.textContent !== title) card.button.textContent = title;
        if (card.button.getAttribute('aria-expanded') !== String(active)) card.button.setAttribute('aria-expanded', String(active));
        const text = bubble.message?.text ?? '';
        if (card.p.textContent !== text) card.p.textContent = text;
        if (card.p.hidden === active) card.p.hidden = !active;
        const maximum = px(bodyHeight);
        if (card.p.style.maxHeight !== maximum) card.p.style.maxHeight = maximum;
      }
      const display = bubbles.length ? 'block' : 'none';
      if (layer.style.display !== display) layer.style.display = display;
      if (newMessage) layer.scrollTop = layer.scrollHeight;
    };
    const aliveTexts = new Map(), hiddenBubbles = new Map();
    const captureFont = text => {
      if (!aliveTexts.has(text)) aliveTexts.set(text, { size: text.style?.fontSize, resolution: text.style?.resolution,
        wrap: text.style?.wordWrapWidth, advanced: text.style?.wordWrapUseAdvanced, padding: { ...text.padding } });
    };
    const getScene = () => {
      const game = window.__cydCapturedGame ?? window.__PIXSIM_GAME__;
      if (!game || game.canvas !== document.querySelector('#game-container canvas')) return null;
      try { return game.scene.getScene('GameScene'); } catch { return null; }
    };
    const attach = () => {
      const scene = getScene();
      if (!scene?.updateMgr || (scene === attachedScene && scene.updateMgr === attachedManager)) return;
      restoreScene(); attachedScene = scene; attachedManager = scene.updateMgr; stats.attached = true;
      const camera = scene.cameras.main, manager = scene.updateMgr;
      const originalCamera = manager.updateCamera;
      let applied = false, baseZoom = camera.zoom, originalRound = camera.roundPixels, lastNamesAt = -Infinity;
      const eligible = () => !scene.interiorSystem?.isActive?.() && !scene.isMapVisible && !scene.isOnSpaceship
        && !document.querySelector('.c-globe-overlay,.house-journey-globe')
        && !scene.isInJumpRunner && !scene.isEnteringDoor && !scene.isExitingBuilding && !scene.isMountingVehicle
        && !scene.isTransitioning && !manager.skyEntryActive && !manager.skyEntryHeld
        && manager.cameraFocusX == null && manager.characterMenuTop == null
        && !scene.registry?.get('globe-driving-open') && !scene.combatMgr?.skySession;
      const gate = () => {
        if (applied && !eligible()) {
          if (Math.abs(camera.zoom - zoom) < .001) scene.setZoom(baseZoom);
          camera.roundPixels = originalRound; applied = false;
        }
        stats.cameraApplied = applied;
      };
      manager.updateCamera = function (...args) {
        const result = Reflect.apply(originalCamera, this, args);
        if (eligible()) {
          if (!applied) { baseZoom = scene.cameraZoom ?? camera.zoom; scene.setZoom(zoom); camera.roundPixels = true; applied = true; }
          // Native camera follow rewrites scroll every frame. Offset after follow,
          // before its prompt/bubble positioning, snapping the projection to LCD pixels.
          camera.scrollY = Math.round((camera.scrollY + offsetY) * camera.zoom * ratio) / (camera.zoom * ratio);
        }
        stats.cameraApplied = applied;
        return result;
      };
      const refresh = () => {
        const now = performance.now();
        if (now - lastNamesAt >= 250) {
          lastNamesAt = now;
          const names = [scene.nameTag,
            ...Array.from(scene.stateSync?.remotePlayers?.values?.() ?? [], player => player.nameTag),
            ...Array.from(scene.persistentCharMgr?.avatars?.values?.() ?? [], avatar => avatar.rp?.nameTag)].filter(text => text?.scene && text.setFontSize);
          stats.names = names.length;
          for (const [text] of aliveTexts) if (!text.scene) aliveTexts.delete(text);
          for (const text of names) {
            captureFont(text);
            const size = Math.round(nameFont / Math.max(.5, Math.abs(text.scaleY) * camera.zoom));
            if (Number.parseFloat(text.style.fontSize) !== size) text.setFontSize(size);
            const wrap = Math.floor(camera.width * .95 / Math.max(.5, Math.abs(text.scaleX) * camera.zoom));
            if (text.style.wordWrapWidth !== wrap) text.setWordWrapWidth?.(wrap, true);
          }
        }
        const prompt = scene.tapActionText;
        if (prompt?.scene && prompt.setFontSize) {
          captureFont(prompt);
          if (Number.parseFloat(prompt.style.fontSize) !== 18) { prompt.setFontSize(18); prompt.setPadding(6, 3); prompt.setResolution(3); }
          if (prompt.input && !prompt.input.customHitArea && prompt.input.hitArea) {
            prompt.input.hitArea.width = prompt.width; prompt.input.hitArea.height = prompt.height;
          }
          const visible = !!prompt.visible && !!prompt.text;
          const value = String(visible);
          if (document.documentElement.dataset.cydWorldPrompt !== value) document.documentElement.dataset.cydWorldPrompt = value;
          if (visible) {
            const screenX = (prompt.x - camera.scrollX - camera.width / 2) * camera.zoom + camera.width / 2;
            const half = prompt.width * Math.abs(prompt.scaleX) * camera.zoom / 2;
            const target = Math.max(5 / ratio + half, Math.min(camera.width - 5 / ratio - half, screenX));
            prompt.x += (target - screenX) / camera.zoom;
          }
        }
        const bubbles = scene.chatBubbleManager?.bubbles ?? [];
        stats.bubbles = bubbles.length;
        for (const bubble of bubbles) {
          if (!hiddenBubbles.has(bubble.container)) hiddenBubbles.set(bubble.container, bubble.container.visible);
          bubble.container.setVisible(false);
        }
        for (const [container] of hiddenBubbles) if (!container.scene) hiddenBubbles.delete(container);
        renderSpeech(bubbles);
      };
      scene.events.on('preupdate', gate); scene.events.on('postupdate', refresh);
      restoreScene = () => {
        scene.events.off('preupdate', gate); scene.events.off('postupdate', refresh);
        manager.updateCamera = originalCamera;
        if (applied && Math.abs(camera.zoom - zoom) < .001) scene.setZoom(baseZoom);
        camera.roundPixels = originalRound;
      };
      refresh();
    };
    attach(); const timer = setInterval(attach, 500);
    window.__cydWorldCleanup = () => {
      clearInterval(timer); restoreScene();
      for (const [text, original] of aliveTexts) if (text.scene) {
        text.setFontSize(original.size); if (original.resolution) text.setResolution(original.resolution);
        text.setWordWrapWidth?.(original.wrap, original.advanced); text.setPadding?.(original.padding);
      }
      for (const [container, visible] of hiddenBubbles) if (container.scene) container.setVisible(visible);
      layer.remove(); style.remove(); delete document.documentElement.dataset.cydWorldPrompt;
    };
    return { ...stats };
  }, options);
}
