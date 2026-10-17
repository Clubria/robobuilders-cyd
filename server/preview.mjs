export function preview({ live, width, height }) {
  return `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>CYD Pixsim ${live ? 'stream' : 'image test'}</title>
<style>body{background:#101827;color:#fff;font:16px system-ui;margin:24px}main{max-width:720px;margin:auto}img{display:block;width:${width}px;max-width:100%;height:auto;border:2px solid #fff;image-rendering:pixelated;touch-action:none;user-select:none}a{color:#7dd3fc}button{min-height:44px;min-width:64px;background:#263b52;border:1px solid #789;color:white;border-radius:8px;font:inherit;cursor:pointer}.controls{display:flex;gap:8px;margin:16px 0;flex-wrap:wrap}#status{font-size:14px;color:#b8ccdf}</style>
<main><h1>CYD ${live ? 'live Pixsim' : 'single-image test'}</h1><p>${live ? 'Live JPEG frames from a separate Pixsim browser. Click the image, or use the controls below.' : 'This is the same JPEG the board will fetch. It is not a live stream.'}</p>
<img id="screen" src="${live ? '/stream.mjpg' : '/frame.jpg'}" width="${width}" height="${height}" alt="CYD ${live ? 'live Pixsim' : 'test'} frame">
<div class="controls" aria-label="Preview size"><button type="button" data-scale="1" aria-pressed="true">1× (${width}×${height})</button><button type="button" data-scale="1.5" aria-pressed="false">1.5× (${width * 1.5}×${height * 1.5})</button></div>
<script>document.querySelectorAll('[data-scale]').forEach(button=>button.onclick=()=>{document.querySelector('#screen').style.width=(${width}*Number(button.dataset.scale))+'px';document.querySelectorAll('[data-scale]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)))})</script>
${live ? '<div class="controls"><button data-key="ArrowLeft">← Left</button><button data-key="ArrowUp">↑ Up</button><button data-key="ArrowDown">↓ Down</button><button data-key="ArrowRight">→ Right</button><button data-key="Enter">Enter</button><button data-key="Escape">Esc</button></div>' : ''}
<p id="status">${width} × ${height} JPEG. Physical CYD connection not verified.</p><a href="/health">Connection status</a></main>
${live ? `<script>
const status=document.querySelector('#status');
async function input(command){try{const r=await fetch('/input',{method:'POST',headers:{'Content-Type':'application/json','X-Input-Source':'preview'},body:JSON.stringify(command)});if(!r.ok)throw Error('Input failed ('+r.status+')');status.textContent='Input sent. Physical CYD connection not verified.'}catch(e){status.textContent=e.message}}
const activeKeys=new Set();
const keyDown=key=>{activeKeys.add(key);void input({action:'key',phase:'down',key})};
const keyUp=key=>{if(activeKeys.delete(key))void input({action:'key',phase:'up',key})};
document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keyDown(b.dataset.key)};b.onpointerup=()=>keyUp(b.dataset.key);b.onpointercancel=()=>keyUp(b.dataset.key)});
setInterval(()=>{for(const key of activeKeys)void input({action:'key',phase:'down',key})},1000);
const screen=document.querySelector('#screen');screen.draggable=false;let held=null,chain=Promise.resolve(),pendingMove=null,moving=false;
const point=e=>{const r=screen.getBoundingClientRect();return {x:Math.min(${width - 1},Math.max(0,Math.floor((e.clientX-r.left)*${width}/r.width))),y:Math.min(${height - 1},Math.max(0,Math.floor((e.clientY-r.top)*${height}/r.height)))}};
const sendPointer=command=>{chain=chain.then(()=>input(command));return chain};
async function flushMove(){if(moving)return;moving=true;while(pendingMove){const command=pendingMove;pendingMove=null;await sendPointer(command)}moving=false}
screen.onpointerdown=e=>{if(held!==null)return;e.preventDefault();held=e.pointerId;screen.setPointerCapture(held);sendPointer({action:'pointer',phase:'down',...point(e)})};
screen.onpointermove=e=>{if(held!==e.pointerId)return;pendingMove={action:'pointer',phase:'move',...point(e)};void flushMove()};
screen.onpointerup=e=>{if(held!==e.pointerId)return;pendingMove=null;held=null;sendPointer({action:'pointer',phase:'up',...point(e)})};
screen.onpointercancel=e=>{if(held!==e.pointerId)return;pendingMove=null;held=null;sendPointer({action:'pointer',phase:'cancel'})};
window.addEventListener('blur',()=>{for(const key of [...activeKeys])keyUp(key);if(held!==null){pendingMove=null;held=null;sendPointer({action:'pointer',phase:'cancel'})}});
const keyFor=e=>({KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d'})[e.code]||e.code;
document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','Enter','Escape','KeyW','KeyA','KeyS','KeyD'].includes(e.code)&&e.target.tagName!=='BUTTON'){e.preventDefault();keyDown(keyFor(e))}});
document.addEventListener('keyup',e=>keyUp(keyFor(e)));
</script>` : ''}</html>`;
}
