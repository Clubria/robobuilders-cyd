export const guide = `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect your little display</title><style>
body{font:17px/1.5 system-ui;margin:32px auto;padding:0 18px;max-width:620px;color:#17202a;background:#fff}h1{font-size:30px;line-height:1.15}h2{font-size:21px;margin-top:28px}li{margin:12px 0}a{color:#174e83}pre{padding:12px;background:#f3f5f7;overflow:auto;font-size:14px;border-radius:8px}.status{padding:12px;background:#f3f5f7;border-radius:8px}small{color:#59636e}details{margin:22px 0}summary{cursor:pointer;min-height:44px}button,.download{display:inline-block;padding:12px 18px;border:0;border-radius:8px;background:#17202a;color:white;text-decoration:none}
</style><h1>Your little display, connected.</h1>
<p>For already-flashed ESP32-024 (2.4″) and JC2432W328 (2.8″) displays.</p>
<div class="status" id="computer" role="status">Checking the computer…</div>
<h2>1. Start the computer</h2>
<p>Download and unzip the bridge. Keep the computer awake and on the same home Wi-Fi.</p>
<a class="download" href="/cyd/download.zip" download>↓ Download bridge ZIP</a>
<p>Open the unzipped folder in your AI coding agent. Ask:</p>
<pre>Read AGENTS.md. Start the Clubria display bridge.
Detect my display without flashing it.
Save this computer’s LAN bridge address over USB.
Help me connect the display to Wi-Fi.
Keep passwords private and the bridge LAN-only.</pre>
<details><summary>First-time computer setup</summary>
<p>This prototype is tested on Mac. Install Node.js 22+, pnpm, Python 3 and Google Chrome first. In Terminal, open the unzipped folder, then run:</p>
<pre>pnpm install --frozen-lockfile
pnpm dev:clubria</pre><p>Leave that Terminal window running. Open <a href="/preview">the preview</a> to check pictures.</p></details>
<h2>2. Connect the display</h2><ol>
<li>Plug in USB for power. On the display, tap <b>2 Wi-Fi</b>.</li>
<li>Scan the QR with your phone. Tap <b>Join</b>. Stay connected even if it says “no internet”.</li>
<li>Tap <b>3 Phone</b> on the display. Scan that QR. Choose home <b>2.4 GHz Wi-Fi</b>, enter its password, then tap <b>Connect</b>.</li>
</ol><p>Return your phone to home Wi-Fi. Pictures should appear on the display.</p>
<h2>3. Know it is working</h2><ul>
<li><b>Power OK:</b> the display is on. USB power alone does not mean data is connected.</li>
<li><b>Wi-Fi connected:</b> it joined your network. Pictures arriving is a separate check.</li>
<li><b>Green side dot:</b> a picture was drawn recently. Short-press BOOT for connection/FPS details.</li>
<li><b>Big checkboxes:</b> your manual checklist only. Tap to tick or untick. The right-hand Done button marks the page complete and continues. Left-hand Back returns. Reset on Run clears checklist ticks only.</li>
</ul><h2>Speed and limits</h2>
<p><b>USB video:</b> roughly 1 picture/second. <b>Wi-Fi:</b> faster; game tests on the 2.8″ display reached 5–7 FPS. The current Clubria computer renderer targets 3 FPS. These are examples, not a guarantee for every display. BOOT stats show actual completed draws.</p>
<p>The TFT has no microphone. Clubria recording and live slide controls need an authorized sign-in and a supported audio source. Nothing records automatically.</p>
<details><summary>Not working?</summary><ul>
<li><b>No pictures:</b> check the computer preview, then the display’s Wi-Fi status.</li>
<li><b>Address changed:</b> on the phone setup page, open Advanced. Use the computer’s LAN address and port <b>3088</b>. Do not use localhost or the Clubria website URL.</li>
<li><b>Phone cannot reach the preview:</b> use the same non-guest Wi-Fi; allow incoming Node connections in the Mac firewall. Do not turn the firewall off.</li>
<li><b>Restart:</b> tap 4 Restart, then Restart again to confirm. Saved Wi-Fi and calibration stay intact.</li>
</ul></details>
<p><small>Today this runs from your computer. Amsterdam hosting and aib.club/cyd are not configured yet. This unauthenticated bridge is for trusted local Wi-Fi only. No public port forwarding.</small></p>
<script>
async function update(){try{const r=await fetch('/health',{cache:'no-store'});if(!r.ok)throw Error();const s=await r.json();const fresh=s.frameAgeMs!==null&&s.frameAgeMs<3000;const recent=s.lastImageRequest&&Date.now()-Date.parse(s.lastImageRequest.at)<5000;document.querySelector('#computer').textContent=(fresh?'✓ Computer: pictures ready':'✕ Computer: pictures paused')+' · '+(recent?'Screen requests received recently':'No recent screen requests')+'. Requests are not proof the TFT drew the picture.';}catch{document.querySelector('#computer').textContent='✕ Computer bridge is not reachable. Start it in Terminal.'}}
update();setInterval(update,3000);
</script></html>`;
