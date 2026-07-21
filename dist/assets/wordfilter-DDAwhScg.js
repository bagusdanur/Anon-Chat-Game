import{c as e,l as t,r as n,s as r,u as i}from"./index-DUqRozNy.js";async function a(e){e.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${f(`shield-ban`)} Word Filter</div>
      <span id="wf-count" class="badge badge-gray">-</span>
    </div>
    <div class="form-row">
      <input class="form-control" id="wf-new" placeholder="Tambah kata terlarang…" style="flex:1">
      <button class="btn btn-primary" id="wf-add">${f(`plus`)} Tambah</button>
    </div>
    <div id="wf-tags"><div style="padding:16px;color:var(--muted)">Memuat…</div></div>
  </div></div>`,document.getElementById(`wf-add`).onclick=l,document.getElementById(`wf-new`).onkeydown=e=>{e.key===`Enter`&&l()},await s(e),window.lucide&&lucide.createIcons({scope:e})}function o(){m=[]}async function s(t){try{m=(await e.get(`/api/wordfilter`)).words||[],c(t)}catch(e){document.getElementById(`wf-tags`).innerHTML=`<div style="padding:16px;color:var(--red)">Gagal: ${e.message}</div>`}}function c(e){let t=document.getElementById(`wf-tags`),n=document.getElementById(`wf-count`);if(n&&(n.textContent=m.length+` kata`),!m.length){t.innerHTML=`<div class="empty-state">${p(`shield-check`)}<p>Belum ada kata terlarang</p></div>`;return}t.innerHTML=`<div class="tag-cloud">
    ${m.map((e,t)=>`
      <span class="tag">
        ${e}
        <span class="tag-rm" data-idx="${t}" title="Hapus">×</span>
      </span>`).join(``)}
  </div>`,t.querySelectorAll(`[data-idx]`).forEach(t=>{t.onclick=()=>u(parseInt(t.dataset.idx),e)}),window.lucide&&lucide.createIcons({scope:e})}function l(){let e=document.getElementById(`wf-new`),t=e.value.trim().toLowerCase();if(!t){r(`Kata tidak boleh kosong`,`warning`);return}if(m.includes(t)){r(`Kata sudah ada`,`warning`);return}m.push(t),e.value=``,d()}function u(e,t){m.splice(e,1),d()}async function d(){try{await e.post(`/api/wordfilter`,{words:m}),r(`Word filter diperbarui`),c(document.querySelector(`.page-enter`))}catch(e){r(e.message,`error`)}}function f(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function p(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}var m;i((()=>{t(),n(),m=[]}))();export{o as cleanup,a as render};