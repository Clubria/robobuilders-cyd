// CYD-only adaptation of the isolated browser; native React nodes/handlers remain.
export async function portraitUI(page, options = {}) {
  await page.evaluate(({ fontScale = 1.65, secondary = 44, action = 48 } = {}) => {
    window.__cydPortraitCleanup?.();
    const ratio = devicePixelRatio || 1;
    // Chromium represents 2/3 DPR as a float. Canonical CSS numbers avoid both
    // subpixel drift and MutationObserver loops caused by style serialization.
    const px = value => `${Math.round(value / ratio * 1000) / 1000}px`;
    const base = window.__cydBaseFont ??= parseFloat(getComputedStyle(document.documentElement).fontSize);
    document.documentElement.style.fontSize = px(Math.round(base * fontScale * ratio));
    const style = document.createElement('style'); style.id = 'cyd-portrait-style';
    style.textContent = `
button[aria-label="Open group chat"],button[aria-label="Walk or ride to your house"],button[aria-label="City time and weather details"],button[aria-label^="Go to "],button[aria-label="Open builder"],.hud-chat-tools,#cyd-latch{display:none!important}
.game-chat-column,#cyd-chat-unavailable{display:none!important}
.game-chat-anchor,.game-chat-anchor>div,.game-chat-dock,.hud-skill-controls,.game-top-controls{transform:none!important;filter:none!important;perspective:none!important;zoom:1!important}
.game-chat-column,#cyd-chat-unavailable{position:fixed!important;left:${px(6)}!important;right:${px(6)}!important;bottom:${px(action + 10)}!important;width:${px(228)}!important;max-height:${px(238)}!important;overflow:auto!important;pointer-events:auto!important;z-index:2147483646!important;font-size:${px(18)}!important;line-height:1.2!important}
#cyd-chat-unavailable{box-sizing:border-box;padding:${px(10)};background:#102030f5;color:white;border:1px solid #8ca6c0;border-radius:${px(8)}}
.game-chat-column .game-chat-form{min-height:${px(44)}!important;background:#102030f5!important}
.game-chat-column input{font-size:${px(18)}!important;line-height:1.2!important}
.game-chat-column button[type="submit"]{min-width:${px(44)}!important;min-height:${px(44)}!important}
.game-chat-column .conversation-replies,.game-chat-column .conversation-replies button{font-size:${px(17)}!important;line-height:1.2!important}
button[data-cyd-avatar]{border-radius:0!important;clip-path:ellipse(50% 55.555556% at 50% 55.555556%);background:#102030ef!important;border:0!important;overflow:hidden!important}
button[data-cyd-avatar] img,button[data-cyd-avatar] canvas{position:absolute!important;left:0!important;top:0!important;width:100%!important;height:${px(32 / .9)}!important;object-fit:cover!important;object-position:center top!important}
button[data-cyd-avatar] svg{width:${px(23)}!important;height:${px(23)}!important}
button[aria-label="World map"]{border-radius:50%!important;background:#102030bf!important}
button[aria-label="World map"] svg{width:${px(21)}!important;height:${px(21)}!important}
.hud-skill-controls{height:0!important;overflow:visible!important;pointer-events:none!important}
html:has(.c-globe-overlay,.house-journey-globe) .hud-skill-controls,html:has(.c-globe-overlay,.house-journey-globe) [data-cyd-avatar],html:has(.c-globe-overlay,.house-journey-globe) button[aria-label="World map"],html:has(.c-globe-overlay,.house-journey-globe) #cyd-mic,html:has(.c-globe-overlay,.house-journey-globe) #cyd-action-caption,html:has(.c-globe-overlay,.house-journey-globe) #cyd-speech{display:none!important}
.hud-skill-controls [data-slot-idx="2"],.hud-skill-controls [data-slot-idx="4"]{display:none!important}
.hud-skill-controls [data-cyd-duplicate],.hud-skill-controls .game-key-hint,#cyd-action-caption{display:none!important}
.hud-skill-controls [data-slot-idx] svg{width:${px(20)}!important;height:${px(20)}!important;stroke-width:1.5!important}
.hud-skill-controls [data-slot-idx="3"] svg{width:${px(28)}!important;height:${px(28)}!important}
#cyd-action-caption{position:fixed;right:${px(5)};bottom:${px(action + 8)};max-width:${px(100)};padding:${px(4)} ${px(7)};border-radius:${px(6)};font:${px(15)}/1.15 system-ui;font-weight:600;color:white;background:#102030ed;border:1px solid #8ca6c0;text-align:center;pointer-events:none;z-index:2147483645}
#game-container{filter:saturate(1.12) contrast(1.05) brightness(1.02)}
#game-container canvas{image-rendering:pixelated!important}
.chooser-world-profile{display:none!important}
html:has(.character-chooser) .hud-skill-controls,html:has(.character-chooser) [data-cyd-avatar],html:has(.character-chooser) #cyd-mic,html:has(.character-chooser) #cyd-action-caption{display:none!important}
.character-chooser{left:${px(4)}!important;right:${px(4)}!important;max-width:${px(232)}!important;z-index:2147483646!important}
html:has(.character-chooser,[data-testid="hub-directory"]) #cyd-speech,html:has([data-testid="hub-directory"]) .hud-skill-controls,html:has([data-testid="hub-directory"]) [data-cyd-avatar],html:has([data-testid="hub-directory"]) #cyd-mic,html:has([data-testid="hub-directory"]) #cyd-action-caption{display:none!important}
html:has(.character-chooser,[data-testid="hub-directory"]) button[aria-label="World map"]{display:none!important}
.chooser-header{gap:${px(3)}!important;padding:${px(5)}!important;flex-wrap:wrap!important}
.chooser-header button{min-height:${px(32)}!important;min-width:${px(32)}!important;font-size:${px(12)}!important}
#chooser-load-tab,.chooser-header>[aria-label="Manage characters"],.chooser-manage{display:none!important}
#cyd-hub{border:1px solid #718096;border-radius:${px(4)};background:#142334;color:white;padding:0 ${px(8)};font:inherit}
[data-testid="hub-directory"]{position:fixed!important;inset:${px(4)}!important;width:auto!important;height:auto!important;max-height:none!important;border-radius:${px(6)}!important;font-size:${px(12)}!important}
[data-testid="hub-directory"]>header{padding:${px(5)}!important;gap:${px(3)}!important}
[data-testid="hub-directory"]>footer,[data-testid="hub-directory"] nav[aria-label="Hub filters"]{display:none!important}
[data-testid="hub-directory"] button,[data-testid="hub-directory"] select,[data-testid="hub-directory"] input{min-height:${px(32)}!important;font-size:${px(12)}!important}
[data-testid="hub-directory"] .hub-person-card{display:grid!important;grid-template-columns:${px(30)} minmax(0,1fr)!important;gap:${px(4)}!important;padding:${px(6)} 0!important}
[data-testid="hub-directory"] .hub-person-photo{width:${px(30)}!important;height:${px(30)}!important}
[data-testid="hub-directory"] .hub-person-info h3{font-size:${px(13)}!important}
[data-testid="hub-directory"] .hub-card-actions{grid-column:1/-1!important;flex-wrap:wrap!important}
[data-testid="hub-directory"] .hub-card-actions a[target="_blank"]{display:none!important}
html[data-cyd-missing="true"] [data-testid="hub-directory"] .hub-person-card:has(button[aria-label^="Play as "]){display:none!important}
#cyd-hub-filter{display:flex;flex-wrap:wrap;gap:${px(4)};align-items:center;padding:${px(4)} 0;font-size:${px(11)}}
#cyd-hub-filter button{border:1px solid #718096;border-radius:${px(4)};padding:0 ${px(6)};background:#142334;color:white}
`;
    document.head.append(style);
    const mic = document.createElement('button'); mic.id = 'cyd-mic';
    mic.setAttribute('aria-label', 'Microphone');
    mic.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
    mic.style.cssText = 'border-radius:50%;background:#102030ef;color:white;border:1px solid #8ca6c0;display:grid;place-items:center;visibility:hidden';
    const caption = document.createElement('div'); caption.id = 'cyd-action-caption'; caption.hidden = true;
    const hub = document.createElement('button'); hub.id = 'cyd-hub'; hub.type = 'button'; hub.textContent = 'Hub'; hub.setAttribute('aria-label', 'Open Hub people');
    const filter = document.createElement('div'); filter.id = 'cyd-hub-filter';
    const missing = document.createElement('button'); missing.type = 'button'; missing.textContent = 'Not in game'; missing.setAttribute('aria-pressed', 'true');
    const hint = document.createElement('span'); hint.textContent = 'This page · Next for more'; filter.append(missing, hint);
    let onlyMissing = true, hubRequested = false, hubTimer;
    document.documentElement.dataset.cydMissing = 'true';
    missing.onclick = () => { onlyMissing = !onlyMissing; document.documentElement.dataset.cydMissing = String(onlyMissing); missing.setAttribute('aria-pressed', String(onlyMissing)); missing.textContent = onlyMissing ? 'Not in game' : 'All people'; };
    let voiceButton;
    const avatarSelector = 'button[aria-label="Choose your character"],button[data-cyd-avatar]';
    const geometry = (node, values) => {
      for (const [property, value] of Object.entries(values)) {
        if (node.style.getPropertyValue(property) !== value || node.style.getPropertyPriority(property) !== 'important') node.style.setProperty(property, value, 'important');
      }
    };
    const box = (node, x, size, top = false, width = size) => geometry(node, {
      position: 'fixed', left: px(x), right: 'auto', top: top ? px(5) : 'auto', bottom: top ? 'auto' : px(2),
      width: px(width), height: px(size), 'min-width': px(width), 'min-height': px(size),
      translate: 'none', transform: 'none', zoom: '1', transition: 'none', animation: 'none', 'pointer-events': 'auto', 'z-index': '2147483647',
    });
    const sync = () => {
      const header = document.querySelector('.character-chooser .chooser-header [role="tablist"]');
      if (header && hub.parentElement !== header) header.append(hub);
      const contributors = document.querySelector('[data-testid="hub-directory"] [aria-label="Contributors"]');
      if (contributors && filter.parentElement !== contributors) contributors.prepend(filter);
      if (hubRequested) {
        const people = [...document.querySelectorAll('.character-chooser nav[aria-label="Character and Hub menu"] button')].find(node => node.textContent.trim() === 'People');
        if (people && !people.disabled) { hubRequested = false; clearTimeout(hubTimer); hub.textContent = 'Hub'; people.click(); }
      }
      voiceButton = document.querySelector('button[title="Join voice room"],button[title="Mute"],button[title="Unmute"]');
      const voice = !!voiceButton && !voiceButton.disabled;
      for (const avatar of document.querySelectorAll(avatarSelector)) {
        avatar.dataset.cydAvatar = '';
        if (avatar.getAttribute('aria-label') !== 'Choose your character') avatar.setAttribute('aria-label', 'Choose your character');
        if (avatar.title !== 'Change character') avatar.title = 'Change character';
        // A true circle of diameter32/.9, clipped to32 high: flat bottom10%,
        // same visible height as the globe, without stretching the artwork.
        box(avatar, 5, 32, true, 32 / .9);
        geometry(avatar, { visibility: 'visible' });
      }
      for (const globe of document.querySelectorAll('button[aria-label="World map"]')) box(globe, 49, 32, true);
      const positions = { '0': 12, '1': 96, '3': 240 - 12 - action };
      const slots = [...document.querySelectorAll('.hud-skill-controls [data-slot-idx]')];
      for (const button of slots) {
        const duplicate = slots.findLast(node => node.dataset.slotIdx === button.dataset.slotIdx) !== button;
        if (duplicate && !button.hasAttribute('data-cyd-duplicate')) button.setAttribute('data-cyd-duplicate', '');
        if (!duplicate && button.hasAttribute('data-cyd-duplicate')) button.removeAttribute('data-cyd-duplicate');
        if (button.hasAttribute('title')) button.removeAttribute('title');
        const x = positions[button.dataset.slotIdx];
        if (x !== undefined) box(button, x, button.dataset.slotIdx === '3' ? action : secondary);
      }
      box(mic, 91, 36, true);
      geometry(mic, { visibility: voice ? 'visible' : 'hidden' });
      if (mic.disabled === voice) mic.disabled = !voice;
      const title = voiceButton ? `${voiceButton.title} using the Mac microphone` : 'Voice is available in a Pixsim voice room; CYD has no built-in mic';
      if (mic.title !== title) mic.title = title;
      const actionButton = slots.findLast(node => node.matches('button[data-slot-idx="3"]'));
      const label = actionButton?.getAttribute('aria-label') ?? '';
      const jumping = /^jump\b/i.test(label.trim());
      if (actionButton) geometry(actionButton, { visibility: 'visible' });
      if (caption.textContent !== label) caption.textContent = label;
      const hide = jumping || !actionButton || actionButton.disabled || !/^(mount|talk|reply|dismount|play|enter|exit|take off|land)/i.test(label);
      if (caption.hidden !== hide) caption.hidden = hide;
    };
    hub.onclick = () => {
      if (hubRequested) return;
      hubRequested = true; hub.textContent = 'Opening…';
      hubTimer = setTimeout(() => { hubRequested = false; hub.textContent = 'Hub'; hub.title = 'Hub unavailable here. Close and reopen the profile to retry.'; }, 2500);
      const manage = document.querySelector('.character-chooser [aria-label="Manage characters"]');
      if (manage && manage.getAttribute('aria-expanded') !== 'true') manage.click();
      sync();
    };
    mic.onclick = () => { if (voiceButton && !voiceButton.disabled) voiceButton.click(); };
    document.body.append(mic, caption); sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['title', 'aria-label', 'aria-expanded', 'disabled', 'style'] });
    window.__cydPortraitCleanup = () => {
      observer.disconnect(); clearTimeout(hubTimer); hub.remove(); filter.remove(); mic.remove(); caption.remove(); style.remove(); delete document.documentElement.dataset.cydMissing;
    };
  }, options);
}
