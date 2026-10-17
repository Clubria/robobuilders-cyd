// Use the native visual-only visibility API; do not force clear weather or alter wet-feet gameplay.
export async function compactWeather(page) {
  await page.evaluate(() => {
    window.__cydWeatherCleanup?.();
    const stats = window.__cydWeatherStats = { attached: false, visualsDisabled: false };
    let attached, restore = () => {};
    const attach = () => {
      let scene;
      try { scene = (window.__cydCapturedGame ?? window.__PIXSIM_GAME__)?.scene.getScene('GameScene'); } catch {}
      const weather = scene?.layerMgr?.dayNightWeather;
      if (!weather || typeof weather.setOutdoorVisible !== 'function' || weather === attached) return;
      restore(); attached = weather;
      const original = weather.setOutdoorVisible;
      let requested = typeof weather.outdoorVisible === 'boolean' ? weather.outdoorVisible : true;
      const limited = function (visible) { requested = visible; return original.call(this, false); };
      weather.setOutdoorVisible = limited;
      original.call(weather, false);
      stats.attached = stats.visualsDisabled = true;
      restore = () => { if (weather.setOutdoorVisible === limited) { weather.setOutdoorVisible = original; original.call(weather, requested); } };
    };
    attach(); const timer = setInterval(attach, 500);
    window.__cydWeatherCleanup = () => { clearInterval(timer); restore(); delete window.__cydWeatherStats; };
  });
}
