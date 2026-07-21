import{c as e,l as t,r as n,s as r,u as i}from"./index-B39UAyRg.js";async function a(e){e.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${c(`wrench`)} Maintenance Mode</div>
      <span id="maint-badge"></span>
    </div>
    <div class="card-body" id="maint-body">
      <div style="padding:20px"><div class="skeleton" style="height:80px"></div></div>
    </div>
  </div></div>`,await s(e),window.lucide&&lucide.createIcons({scope:e})}function o(){}async function s(t){try{let n=await e.get(`/api/maintenance`),i=n.enabled,a=document.getElementById(`maint-badge`);a&&(a.innerHTML=i?`<span class="badge badge-red">${c(`alert-triangle`)} MAINTENANCE ON</span>`:`<span class="badge badge-green">${c(`check-circle`)} BOT AKTIF</span>`),window.lucide&&lucide.createIcons({scope:a});let o=document.getElementById(`maint-body`);if(!o)return;o.innerHTML=`
      <div class="maintenance-banner ${i?`on`:`off`}" style="margin-bottom:20px">
        <div style="font-size:40px;margin-bottom:6px">${i?`🔴`:`🟢`}</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">
          <span class="pulse ${i?`red`:`green`}"></span>
          ${i?`MAINTENANCE MODE AKTIF`:`BOT BERJALAN NORMAL`}
        </div>
        <div style="font-size:13px;color:var(--muted)">
          ${i?`User tidak bisa menggunakan bot. Admin tetap bisa akses.`:`Semua fitur bot berjalan normal.`}
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:20px">
        <button class="btn ${i?`btn-success`:`btn-danger`} btn-lg btn-full" id="maint-toggle">
          ${i?`${c(`play`)} Nonaktifkan Maintenance`:`${c(`power`)} Aktifkan Maintenance`}
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">Pesan Maintenance</label>
        <textarea class="form-control" id="maint-msg" style="min-height:100px">${n.message||``}</textarea>
      </div>
      <button class="btn btn-primary" id="maint-save">${c(`save`)} Simpan Pesan</button>`,window.lucide&&lucide.createIcons({scope:o}),document.getElementById(`maint-toggle`).onclick=async()=>{let a=document.getElementById(`maint-msg`)?.value?.trim()||n.message;await e.post(`/api/maintenance`,{enabled:!i,message:a}),r(i?`🟢 Maintenance dinonaktifkan!`:`🔴 Maintenance diaktifkan!`,i?`success`:`warning`),s(t)},document.getElementById(`maint-save`).onclick=async()=>{let t=document.getElementById(`maint-msg`)?.value?.trim();if(!t){r(`Pesan tidak boleh kosong`,`warning`);return}await e.post(`/api/maintenance`,{enabled:i,message:t}),r(`Pesan maintenance disimpan`)}}catch(e){document.getElementById(`maint-body`).innerHTML=`<div style="color:var(--red)">Gagal: ${e.message}</div>`}}function c(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}i((()=>{t(),n()}))();export{o as cleanup,a as render};