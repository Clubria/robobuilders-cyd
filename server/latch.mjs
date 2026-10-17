// The CST820 is single-touch. These latches combine held movement with pointer actions.
export async function installLatch(page, controls) {
  await page.exposeFunction('cydLatch', direction => {
    if (![-1, 0, 1].includes(direction)) throw new Error('Invalid latch direction');
    return controls.latch(direction);
  });
  await page.evaluate(() => {
    const bar = document.createElement('div');
    bar.id = 'cyd-latch';
    bar.style.cssText = 'position:fixed;left:12px;bottom:110px;display:flex;gap:6px;z-index:2147483647;pointer-events:auto;font:12px system-ui';
    for (const [direction, label] of [[-1, '← Hold'], [0, 'Stop'], [1, 'Hold →']]) {
      const button = document.createElement('button');
      button.textContent = label;
      button.dataset.cydDirection = String(direction);
      button.style.cssText = 'min-width:54px;min-height:44px;color:white;background:#102030e8;border:1px solid #8ca6c0;border-radius:12px;touch-action:none';
      button.onclick = () => { void window.cydLatch(direction); };
      bar.append(button);
    }
    window.__cydSetLatch = direction => {
      for (const button of bar.children) button.style.background = direction && Number(button.dataset.cydDirection) === direction ? '#155e75' : '#102030e8';
    };
    document.body.append(bar);
  });
}
