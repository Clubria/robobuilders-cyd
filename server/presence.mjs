// Presentation only: reuse native presence entries/actions; never query a second roster.
export async function presenceUI(page, options = {}) {
  await page.evaluate(({ idleMs = 650 } = {}) => {
    window.__cydPresenceCleanup?.();
    const ratio = devicePixelRatio || 1, px = value => `${Math.round(value / ratio * 1000) / 1000}px`;
    const style = document.createElement('style'); style.id = 'cyd-presence-style';
    style.textContent = `
.online-player-hud{gap:0!important;padding-top:0!important;padding-bottom:0!important;max-height:${px(104)}!important;max-width:${px(152)}!important}
.online-player-hud button.online-player-name[aria-label^="Go to "]{display:flex!important;min-height:${px(23)}!important;min-width:0!important;padding:0!important;margin:0!important;line-height:${px(23)}!important;font-size:${px(12)}!important;border-radius:0!important;gap:${px(4)}!important}
.online-player-hud .online-player-city{font-size:${px(10)}!important;line-height:1!important}
html:not([data-cyd-still="true"]) .online-player-hud,html:has(.character-chooser,[data-testid="hub-directory"],.c-globe-overlay,.house-journey-globe,#cyd-speech article) .online-player-hud{display:none!important}
`;
    document.head.append(style);
    let previous, attached, lastMovedAt = performance.now();
    const state = window.__cydPresenceStats = { still: false };
    const update = () => {
      const game = window.__cydCapturedGame ?? window.__PIXSIM_GAME__;
      let scene;
      try { scene = game?.scene.getScene('GameScene'); } catch {}
      const player = scene?.player, now = performance.now();
      let still = false;
      if (player && Number.isFinite(player.x) && Number.isFinite(player.y)) {
        if (scene !== attached) { previous = undefined; attached = scene; lastMovedAt = now; }
        const velocity = player.body?.velocity;
        const moving = Math.hypot(velocity?.x ?? 0, velocity?.y ?? 0) > .5
          || (previous && Math.hypot(player.x - previous.x, player.y - previous.y) > .5);
        if (moving) lastMovedAt = now;
        previous = { x: player.x, y: player.y };
        still = now - lastMovedAt >= idleMs;
      } else { previous = attached = undefined; lastMovedAt = now; }
      state.still = still;
      if (document.documentElement.dataset.cydStill !== String(still)) document.documentElement.dataset.cydStill = String(still);
    };
    update(); const timer = setInterval(update, 100);
    window.__cydPresenceCleanup = () => { clearInterval(timer); style.remove(); delete document.documentElement.dataset.cydStill; delete window.__cydPresenceStats; };
  }, options);
}
