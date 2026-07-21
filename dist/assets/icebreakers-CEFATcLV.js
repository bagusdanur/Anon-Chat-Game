import{c as e,l as t,r as n,s as r,u as i}from"./index-CMn0ttVB.js";async function a(e){e.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${d(`message-circle`)} Icebreakers</div>
      <span id="ice-count" class="badge badge-gray">-</span>
    </div>
    <div class="form-row">
      <input class="form-control" id="ice-new" placeholder="Tambah pertanyaan baru…" style="flex:1">
      <button class="btn btn-primary" id="ice-add">${d(`plus`)} Tambah</button>
    </div>
    <div id="ice-list"><div style="padding:16px;color:var(--muted)">Memuat…</div></div>
  </div></div>`,document.getElementById(`ice-add`).onclick=l,document.getElementById(`ice-new`).onkeydown=e=>{e.key===`Enter`&&l()},await s(e),window.lucide&&lucide.createIcons({scope:e})}function o(){p=[]}async function s(t){try{p=(await e.get(`/api/icebreakers`)).questions||[],c(t)}catch(e){document.getElementById(`ice-list`).innerHTML=`<div style="padding:16px;color:var(--red)">Gagal: ${e.message}</div>`}}function c(e){let t=document.getElementById(`ice-list`),n=document.getElementById(`ice-count`);if(n&&(n.textContent=p.length+` pertanyaan`),!p.length){t.innerHTML=`<div class="empty-state">${f(`message-circle`)}<p>Belum ada pertanyaan</p></div>`;return}t.innerHTML=`<div class="tag-cloud" style="flex-direction:column;gap:6px">
    ${p.map((e,t)=>`
      <span class="tag" style="width:100%;justify-content:space-between;padding:10px 14px">
        <span style="font-size:13px;flex:1;line-height:1.4">${e}</span>
        <span class="tag-rm" data-idx="${t}" title="Hapus">×</span>
      </span>`).join(``)}
  </div>`,t.querySelectorAll(`[data-idx]`).forEach(t=>{t.onclick=()=>{p.splice(parseInt(t.dataset.idx),1),u(e)}})}function l(){let e=document.getElementById(`ice-new`),t=e.value.trim();if(!t){r(`Pertanyaan tidak boleh kosong`,`warning`);return}p.push(t),e.value=``,u(document.querySelector(`.page-enter`))}async function u(t){try{await e.post(`/api/icebreakers`,{questions:p}),r(`Icebreakers diperbarui`),c(t)}catch(e){r(e.message,`error`)}}function d(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function f(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}var p;i((()=>{t(),n(),p=[]}))();export{o as cleanup,a as render};