// Small receiver chrome around Clubria's existing timer/recorder/slides, not a clone.
export async function prepareClubria(page, origin) {
  await page.evaluateOnNewDocument(origin => {
    if (location.origin !== origin || new URL(location.href).searchParams.get('cyd') !== 'mini') return;
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
body{margin:0;background:#000}
#cyd-events{position:sticky;top:0;z-index:60;background:#111;padding:4px;font:14px system-ui}
#cyd-events summary,#cyd-events button{min-height:44px;box-sizing:border-box;padding:10px;width:100%;text-align:left;background:#181818;color:#fff;border:0}
#cyd-events>div{max-height:230px;overflow:auto}
.c-event-timer .c-compact-recorder{margin:4px;padding:8px}
.c-event-timer .c-compact-recorder button{min-width:44px;min-height:44px}
.c-event-timer:has(.c-compact-recorder)>.flex-1{display:none}
.c-timer-bottom-bar>div{flex-wrap:wrap}
.c-timer-bottom-bar>div>div{order:-1;flex-basis:100%;gap:8px!important}
.c-timer-bottom-bar>div>button{flex:1;min-height:44px}
.c-timer-bottom-bar>div>div>div>div{width:104px!important;height:59px!important}
.c-timer-bottom-bar>div>div iframe{transform:scale(.0541667)!important}
[data-cyd-consent]{display:none!important}
`;
      document.head.append(style);
      const picker = document.createElement('details'); picker.id = 'cyd-events';
      const city = new URL(location.href).searchParams.get('city') || 'AMS';
      const label = document.createElement('summary'); label.textContent = `Choose event · ${city}`;
      const list = document.createElement('div'); list.textContent = 'Loading events…';
      picker.append(label, list); document.body.prepend(picker);
      // Public directory only. No auth bypass, live writes, recording or consent clicks.
      fetch(`/api/public/events?city=${encodeURIComponent(city)}`).then(async response => {
        if (!response.ok) throw new Error('Directory unavailable');
        const events = await response.json();
        if (!Array.isArray(events)) throw new Error('Invalid directory');
        list.textContent = '';
        for (const event of events) {
          if (!event.eventCode || !event.eventTitle) continue;
          const button = document.createElement('button'); button.type = 'button';
          button.textContent = `${event.eventDate ?? ''} · ${event.eventTitle}`;
          button.onclick = () => { location.href = `/e/${encodeURIComponent(event.eventCode)}/timer?record=1&cyd=mini&city=${encodeURIComponent(city)}`; };
          list.append(button);
        }
        if (!list.children.length) list.textContent = 'No upcoming events';
      }).catch(() => { list.textContent = 'Events unavailable. Reload to retry.'; });
      // Hide only the analytics prompt on this receiver, without recording a choice.
      const markConsent = () => {
        for (const button of document.querySelectorAll('button')) {
          if (button.textContent.trim() === 'No thanks' && /PostHog.*Umami/s.test(button.closest('.fixed')?.textContent ?? '')) {
            const card = button.closest('.fixed');
            if (card && !card.hasAttribute('data-cyd-consent')) card.setAttribute('data-cyd-consent', '');
          }
        }
      };
      new MutationObserver(markConsent).observe(document.body, { childList: true, subtree: true });
      markConsent();
    }, { once: true });
  }, origin);
}
