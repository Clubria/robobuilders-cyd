#pragma once

// Local setup AP only. Never interpolate or return the saved Wi-Fi password.
static const char SETUP_PAGE[] PROGMEM = R"html(<!doctype html>
<html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CYD Wi-Fi</title><style>
body{font:16px system-ui;background:#fff;color:#181818;margin:32px auto;padding:0 20px;max-width:460px}
h1{font-size:28px;font-weight:500;letter-spacing:-1px}label{display:block;margin-top:18px}input,button,select{box-sizing:border-box;width:100%;min-height:46px;margin:6px 0;font:inherit;border-radius:3px;padding:10px;border:1px solid #d5d5d5}
input,select{background:#fff;color:inherit}button{background:#181818;color:#fff;font-weight:500}button.secondary{background:#fff;color:inherit}button:disabled{opacity:.5}
small,p,summary{color:#626262;line-height:1.5}#status{min-height:28px;color:#333;border-top:1px solid #e6e6e6;padding-top:18px}details{margin:18px 0}a{color:#333}
</style><h1>Connect display</h1><p>Choose your <b>2.4 GHz Wi-Fi</b>. Settings are remembered.</p>
<form id="setup" method="POST" action="/save">
<label for="saved">Saved connections</label><select id="saved">__SAVED_CONNECTIONS__</select>
<label for="ssid">Wi-Fi network</label><input id="ssid" name="ssid" list="networks" maxlength="32" required value="__SSID__" autocomplete="off"><datalist id="networks"></datalist>
<button type="button" class="secondary" id="scan">Find networks</button>
<label for="password">Wi-Fi password</label><input id="password" name="password" type="password" minlength="8" maxlength="63" autocomplete="new-password"><small id="password-help"></small>
<details id="advanced"><summary>Advanced</summary><label><input style="width:auto;min-height:0" type="checkbox" id="open" name="open" value="1"> This network has no password</label>
<label for="server">Renderer address</label><input id="server" name="server" required value="__SERVER__" maxlength="180" placeholder="http://192.168.x.x:3088"><small>Already filled in. Change only when the renderer moves.</small></details>
<button id="save">Connect</button></form><p id="status" role="status" aria-live="polite">Ready to connect</p>
<p>After connecting, return your phone to home Wi-Fi.</p>
<p><a href="__SERVER__/cyd">Computer help and download</a></p>
<script>
const status=document.querySelector('#status'),scan=document.querySelector('#scan'),form=document.querySelector('#setup');
let savedNetwork=document.querySelector('#ssid').value,hasPassword=__HAS_PASSWORD__;
const password=document.querySelector('#password'),openNetwork=document.querySelector('#open');
document.querySelector('#saved').onchange=event=>{const option=event.target.selectedOptions[0];if(!option.value)return;savedNetwork=option.value;hasPassword=option.dataset.secured==='true';document.querySelector('#ssid').value=savedNetwork;document.querySelector('#server').value=option.dataset.server;password.value='';openNetwork.checked=!hasPassword;passwordHint()};
function passwordHint(){const reuse=hasPassword&&document.querySelector('#ssid').value===savedNetwork&&!openNetwork.checked;document.querySelector('#password-help').textContent=reuse?'Password saved on CYD. Leave blank to keep it, or type a replacement.':'Enter this network’s password. Nothing is stored in this browser.';password.disabled=openNetwork.checked;password.required=!reuse&&!openNetwork.checked}
document.querySelector('#ssid').oninput=passwordHint;openNetwork.onchange=passwordHint;passwordHint();
let saving=false;
scan.onclick=async()=>{if(saving)return;scan.disabled=true;document.querySelector('#save').disabled=true;status.textContent='Scanning';try{for(let i=0;i<12;i++){const r=await fetch('/networks',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(!data.scanning){const list=document.querySelector('#networks');list.replaceChildren();for(const name of data.networks){const option=document.createElement('option');option.value=name;list.append(option)}status.textContent=data.networks.length?'Choose a network above':'No networks found — type the name';return}await new Promise(resolve=>setTimeout(resolve,750))}status.textContent='Scan timed out — try again'}catch{status.textContent='Reconnect to the CYD setup Wi-Fi'}finally{scan.disabled=false;document.querySelector('#save').disabled=saving}};
form.onsubmit=async event=>{
  event.preventDefault();if(saving||scan.disabled)return;
  const submission=new URLSearchParams(new FormData(form));
  saving=true;scan.disabled=true;document.querySelector('#save').disabled=true;
  const fields=[...form.querySelectorAll('input,select')],disabled=fields.map(field=>field.disabled);
  fields.forEach(field=>field.disabled=true);
  status.textContent='Saving and joining home Wi-Fi';
  try{
    const r=await fetch('/save',{method:'POST',body:submission});
    if(!r.ok){status.textContent=await r.text();return}
    savedNetwork=submission.get('ssid');hasPassword=submission.get('open')!=='1';
    password.value='';
    status.textContent='Saved on CYD — check its Wi-Fi status, then reconnect phone to home Wi-Fi. Losing this setup page during handover is normal.';
    for(let i=0;i<25;i++){
      await new Promise(resolve=>setTimeout(resolve,1000));
      try{
        const r=await fetch('/status',{cache:'no-store'});if(!r.ok)break;
        const data=await r.json();
        if(data.failed){status.textContent='Could not join home Wi-Fi — settings are saved. Check 2.4 GHz network and password.';break}
        if(data.wifiConnected){status.textContent='CYD joined home Wi-Fi. Reconnect your phone to home Wi-Fi; check CYD for Mac stream status.';break}
      }catch{break}
    }
  }catch{status.textContent='Connection interrupted — reconnect to CYD setup Wi-Fi'}
  finally{fields.forEach((field,i)=>field.disabled=disabled[i]);passwordHint();saving=false;scan.disabled=false;document.querySelector('#save').disabled=false}
};
</script></html>)html";
