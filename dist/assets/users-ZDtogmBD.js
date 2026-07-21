import{a as e,c as t,i as n,l as r,n as i,r as a,s as o,t as s,u as c}from"./index-CQ80I5cs.js";async function l(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${v(`users`)} Users</div>
      <button class="btn btn-outline btn-sm" id="users-refresh">${v(`refresh-cw`)} Refresh</button>
    </div>
    <div class="form-row" style="align-items:center">
      <input class="form-control" id="u-search" placeholder="Cari Chat ID, lang, gender…" style="flex:1;min-width:180px">
      <select class="form-control" id="u-status" style="width:140px">
        <option value="">Semua Status</option>
        <option value="idle">Idle</option>
        <option value="queued">Queued</option>
        <option value="chatting">Chatting</option>
      </select>
      <select class="form-control" id="u-ban" style="width:130px">
        <option value="">Semua</option>
        <option value="0">Aktif</option>
        <option value="1">Banned</option>
      </select>
    </div>
    <div id="users-table">${e(8)}</div>
  </div></div>`,document.getElementById(`users-refresh`).onclick=()=>d(t),document.getElementById(`u-search`).oninput=x(f,250),document.getElementById(`u-status`).onchange=f,document.getElementById(`u-ban`).onchange=f,await d(t),window.lucide&&lucide.createIcons({scope:t})}function u(){}async function d(n){let r=document.getElementById(`users-table`);if(r){r.innerHTML=e(8);try{S=await t.get(`/api/users`),document.getElementById(`users-table`).closest(`.card`).querySelector(`.card-title`).innerHTML=`${v(`users`)} Users (${S.length})`,p(S),window.lucide&&lucide.createIcons({scope:n})}catch(e){r.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}}function f(){let e=(document.getElementById(`u-search`)?.value||``).toLowerCase(),t=document.getElementById(`u-status`)?.value||``,n=document.getElementById(`u-ban`)?.value,r=S;e&&(r=r.filter(t=>String(t.chat_id).includes(e)||(t.lang||``).includes(e)||(t.gender||``).includes(e))),t&&(r=r.filter(e=>e.status===t)),n!==void 0&&n!==``&&(r=r.filter(e=>e.is_banned===+n)),p(r),window.lucide&&lucide.createIcons({scope:document.getElementById(`users-table`)})}function p(e){let t=document.getElementById(`users-table`);if(t){if(!e.length){t.innerHTML=`<div class="empty-state">${y(`users`)}<p>Tidak ada user ditemukan</p></div>`;return}t.innerHTML=`<div class="table-wrap"><table>
    <thead><tr>
      <th>Chat ID</th><th>Status</th><th>Lang</th><th>Gender</th><th>Ban</th><th>Bergabung</th><th>Aksi</th>
    </tr></thead>
    <tbody>${e.map(e=>{let t=e.status===`chatting`?`badge-green`:e.status===`queued`?`badge-yellow`:`badge-gray`,n=e.status===`chatting`?`heart`:e.status===`queued`?`clock`:`user`;return`<tr data-clickable data-id="${e.chat_id}">
      <td><code style="color:var(--accent);font-size:12px">${e.chat_id}</code></td>
      <td><span class="badge ${t}">${v(n)} ${e.status}</span></td>
      <td>${e.lang||`any`}</td>
      <td>${e.gender||`-`}</td>
      <td>${e.is_banned?`<span class="badge badge-red">${v(`ban`)} Banned</span>`:`<span class="badge badge-gray">OK</span>`}</td>
      <td style="font-size:12px;color:var(--muted)">${b(e.created_at)}</td>
      <td onclick="event.stopPropagation()" class="td-actions">
        ${e.is_banned?`<button class="btn btn-success btn-sm" data-action="unban" data-id="${e.chat_id}">${v(`check`)}</button>`:`<button class="btn btn-danger btn-sm" data-action="ban" data-id="${e.chat_id}">${v(`ban`)}</button>`}
        <button class="btn btn-blue btn-sm" data-action="send" data-id="${e.chat_id}">${v(`send`)}</button>
      </td>
    </tr>`}).join(``)}</tbody>
  </table></div>`,t.querySelectorAll(`[data-action]`).forEach(e=>{e.onclick=t=>{t.stopPropagation();let{action:n,id:r}=e.dataset;n===`ban`&&m(r),n===`unban`&&h(r),n===`send`&&_(r)}}),t.querySelectorAll(`[data-clickable]`).forEach(e=>{e.onclick=()=>g(e.dataset.id)})}}async function m(e){i(`Ban user <code>${e}</code>?`,async()=>{try{await t.post(`/api/users/${e}/ban`),o(`User berhasil di-ban`,`success`);let n=S.find(t=>t.chat_id==e);n&&(n.is_banned=1),f(),window.lucide&&lucide.createIcons({scope:document.getElementById(`users-table`)})}catch(e){o(e.message,`error`)}})}async function h(e){try{await t.post(`/api/users/${e}/unban`),o(`User di-unban`,`success`);let n=S.find(t=>t.chat_id==e);n&&(n.is_banned=0),f(),window.lucide&&lucide.createIcons({scope:document.getElementById(`users-table`)})}catch(e){o(e.message,`error`)}}async function g(e){n(`${v(`user`)} User: ${e}`,`<div style="display:flex;align-items:center;gap:10px;padding:20px"><div class="skeleton" style="height:14px;flex:1"></div></div>`,`<button class="btn btn-outline" onclick="closeModal()">Tutup</button>`);try{let r=await t.get(`/api/users/${e}`),i=r.user,a=r.rpg,c=`
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="info-grid">
          <div class="info-cell"><div class="info-cell-label">Chat ID</div><div class="info-cell-value"><code>${i.chat_id}</code></div></div>
          <div class="info-cell"><div class="info-cell-label">Status</div><div class="info-cell-value">${i.status}</div></div>
          <div class="info-cell"><div class="info-cell-label">Bahasa</div><div class="info-cell-value">${i.lang||`any`}</div></div>
          <div class="info-cell"><div class="info-cell-label">Gender</div><div class="info-cell-value">${i.gender||`any`}</div></div>
          <div class="info-cell"><div class="info-cell-label">Status Ban</div><div class="info-cell-value">${i.is_banned?`<span class="badge badge-red">Banned</span>`:`<span class="badge badge-gray">Aktif</span>`}</div></div>
          <div class="info-cell"><div class="info-cell-label">Bergabung</div><div class="info-cell-value" style="font-size:12px">${b(i.created_at)}</div></div>
        </div>
        ${a?`<div class="card" style="margin:0"><div class="card-header"><div class="card-title">${v(`swords`)} RPG Character</div></div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-cell"><div class="info-cell-label">Class</div><div class="info-cell-value">${a.class_name}</div></div>
              <div class="info-cell"><div class="info-cell-label">Level</div><div class="info-cell-value">Lv.${a.level}</div></div>
              <div class="info-cell"><div class="info-cell-label">Gold</div><div class="info-cell-value">${a.gold}g</div></div>
              <div class="info-cell"><div class="info-cell-label">HP</div><div class="info-cell-value">${a.hp}/${a.max_hp}</div></div>
            </div>
          </div></div>`:`<p style="color:var(--muted);font-size:13px">Tidak ada karakter RPG</p>`}
        ${r.reports?.length?`<div class="card" style="margin:0"><div class="card-header"><div class="card-title">${v(`flag`)} Reports Terkait</div></div>
          <div class="card-body" style="font-size:12px">${r.reports.map(e=>`<div style="padding:6px 0;border-bottom:1px solid var(--border-dark)">${b(e.created_at)} — ${e.reason||`-`}</div>`).join(``)}</div></div>`:``}
      </div>`,l=`
      <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
      <button class="btn btn-yellow" id="um-reset">Reset Status</button>
      ${i.is_banned?`<button class="btn btn-success" id="um-unban">Unban</button>`:`<button class="btn btn-danger" id="um-ban">Ban</button>`}
      ${a?`<button class="btn btn-danger" id="um-rpgdel">Hapus RPG</button>`:``}`;n(`${v(`user`)} User: ${e}`,c,l),window.lucide&&lucide.createIcons({scope:document.getElementById(`modal-overlay`)}),document.getElementById(`um-reset`)?.addEventListener(`click`,async()=>{await t.post(`/api/users/${e}/reset`),o(`Status direset`),s();let n=S.find(t=>t.chat_id==e);n&&(n.status=`idle`),f()}),document.getElementById(`um-ban`)?.addEventListener(`click`,()=>{s(),m(e)}),document.getElementById(`um-unban`)?.addEventListener(`click`,()=>{s(),h(e)}),document.getElementById(`um-rpgdel`)?.addEventListener(`click`,async()=>{window.confirm(`Hapus data RPG user ini?`)&&(await t.post(`/api/rpg-users/${e}/reset`),o(`RPG dihapus`),s())})}catch(e){o(e.message,`error`),s()}}function _(e){n(`${v(`send`)} Kirim ke ${e}`,`<div class="form-row"><textarea class="form-control" id="sendMsg-text" placeholder="Pesan untuk user…"></textarea></div>`,`<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="sendMsg-btn">${v(`send`)} Kirim</button>`),document.getElementById(`sendMsg-btn`).onclick=async()=>{let n=document.getElementById(`sendMsg-text`)?.value?.trim();if(n)try{await t.post(`/api/send`,{chat_id:e,message:n}),o(`Pesan terkirim!`),s()}catch(e){o(e.message,`error`)}}}function v(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function y(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}function b(e){if(!e)return`-`;try{return new Date(e).toLocaleString(`id-ID`,{dateStyle:`short`,timeStyle:`short`})}catch{return e}}function x(e,t){let n;return(...r)=>{clearTimeout(n),n=setTimeout(()=>e(...r),t)}}var S;c((()=>{r(),a(),S=[]}))();export{u as cleanup,l as render};