// A separate browser profile, not a Pixsim source fork or an all-FX-off claim.
export const compactPreferences = Object.freeze({
  mode: 'lightweight', backgroundRefresh: false, animatedScenery: false,
});

export async function prepareCompact(page, origin) {
  await page.setCacheEnabled(true);
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  // Preferences are memoized by the game: set them before its scripts initialize.
  await page.evaluateOnNewDocument((expectedOrigin, preferences) => {
    if (location.origin !== expectedOrigin) return;
    try {
      localStorage.setItem('pixsim_animation_preferences', JSON.stringify(preferences));
      localStorage.setItem('pixsim_globe_driving', 'off');
    } catch {}
  }, origin, compactPreferences);
}

export async function compactUi(page) {
  const style = await page.addStyleTag({ content: `
.character-switch-effect{display:none!important}
.globe-drive-controls{display:none!important}
.pixsim-game :not(canvas){animation:none!important;transition:none!important;box-shadow:none!important;backdrop-filter:none!important}
` });
  await style?.evaluate(node => { node.id = 'cyd-compact-style'; });
}
