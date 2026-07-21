import{c as e,l as t,u as n}from"./index-B39UAyRg.js";async function r(e){e.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${s(`file-text`)} Bot Logs <span style="font-size:12px;color:var(--muted);font-weight:500">(last 100 lines)</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="log-wrap" style="cursor:pointer"> Wrap
        </label>
        <button class="btn btn-outline btn-sm" id="log-refresh">${s(`refresh-cw`)}</button>
      </div>
    </div>
    <div class="log-viewer" id="log-viewer">
      <div style="color:var(--muted);font-size:12px">Memuat log…</div>
    </div>
  </div></div>`,document.getElementById(`log-refresh`).onclick=()=>a(),document.getElementById(`log-wrap`).onchange=e=>{let t=document.getElementById(`log-viewer`);t&&(t.style.whiteSpace=e.target.checked?`pre-wrap`:`pre`)},await a(),window.lucide&&lucide.createIcons({scope:e})}function i(){}async function a(){let t=document.getElementById(`log-viewer`);if(t)try{let n=await e.get(`/api/logs`);if(!n.logs?.length){t.innerHTML=`<div style="color:var(--muted);font-size:12px;padding:8px">Tidak ada log tersimpan.</div>`;return}t.innerHTML=n.logs.map(e=>`<div class="log-line ${e.includes(`ERROR`)||e.includes(`error`)?`error`:e.includes(`WARN`)||e.includes(`warn`)?`warn`:e.includes(`INFO`)||e.includes(`info`)?`info`:``}">${o(e)}</div>`).join(``),t.scrollTop=t.scrollHeight}catch(e){t.innerHTML=`<div style="color:var(--red);font-size:12px">Gagal memuat log: ${e.message}</div>`}}function o(e){return e.replace(/&/g,`&amp;`).replace(/</g,`&lt;`).replace(/>/g,`&gt;`)}function s(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}n((()=>{t()}))();export{i as cleanup,r as render};