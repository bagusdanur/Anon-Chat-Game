import{a as e,c as t,i as n,l as r,r as i,s as a,t as o,u as s}from"./index-CMn0ttVB.js";async function c(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${m(`swords`)} RPG Players</div>
      <button class="btn btn-outline btn-sm" id="rpg-refresh">${m(`refresh-cw`)}</button>
    </div>
    <div id="rpg-table">${e(8)}</div>
  </div></div>`,document.getElementById(`rpg-refresh`).onclick=()=>u(t),await u(t)}function l(){}async function u(n){let r=document.getElementById(`rpg-table`);if(r){r.innerHTML=e(8);try{let e=await t.get(`/api/rpg-users`);if(n.querySelector(`.card-title`).innerHTML=`${m(`swords`)} RPG Players (${e.length})`,!e.length){r.innerHTML=`<div class="empty-state">${h(`swords`)}<p>Belum ada RPG player</p></div>`;return}let i=e=>e===`ksatria`?`⚔️`:e===`penyihir`?`🔮`:`🗡️`,a=e=>e===`ksatria`?`badge-blue`:e===`penyihir`?`badge-accent`:`badge-yellow`;r.innerHTML=`<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Class</th><th>Level</th><th>XP</th><th>Gold</th><th>HP</th><th>Stats</th></tr></thead>
      <tbody>${e.map(e=>`
      <tr data-clickable data-id="${e.telegram_user_id}">
        <td><code style="color:var(--accent);font-size:12px">${e.telegram_user_id}</code></td>
        <td><span class="badge ${a(e.class_name)}">${i(e.class_name)} ${e.class_name}</span></td>
        <td><strong>Lv.${e.level}</strong></td>
        <td>${e.xp.toLocaleString()} XP</td>
        <td>💰 ${e.gold.toLocaleString()}g</td>
        <td>❤️ ${e.hp}/${e.max_hp}</td>
        <td>⚔️${e.atk} 🛡️${e.def}</td>
      </tr>`).join(``)}</tbody>
    </table></div>`,r.querySelectorAll(`[data-clickable]`).forEach(e=>{e.onclick=()=>d(e.dataset.id)}),window.lucide&&lucide.createIcons({scope:n})}catch(e){r.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}}async function d(e){n(`${m(`swords`)} RPG Detail: ${e}`,`<div style="padding:20px"><div class="skeleton" style="height:14px"></div></div>`,``);try{let r=await t.get(`/api/rpg-users/${e}`),i=r.user,s=e=>e===`legendary`?`badge-orange`:e===`epic`?`badge-accent`:e===`rare`?`badge-blue`:e===`uncommon`?`badge-green`:`badge-gray`,c=r.inventory.length?r.inventory.map(e=>`<span class="badge ${s(e.rarity)}">${e.display_name}${e.equipped?` ⚡`:``} x${e.quantity}</span>`).join(` `):`<span style="color:var(--muted)">Inventori kosong</span>`,l=`
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="info-grid">
          <div class="info-cell"><div class="info-cell-label">Class</div><div class="info-cell-value">${i.class_name}</div></div>
          <div class="info-cell"><div class="info-cell-label">Level</div><div class="info-cell-value">Lv.${i.level}</div></div>
          <div class="info-cell"><div class="info-cell-label">XP</div><div class="info-cell-value">${i.xp.toLocaleString()}</div></div>
          <div class="info-cell"><div class="info-cell-label">Gold</div><div class="info-cell-value">${i.gold.toLocaleString()}g</div></div>
          <div class="info-cell"><div class="info-cell-label">HP</div><div class="info-cell-value">${i.hp}/${i.max_hp}</div></div>
          <div class="info-cell"><div class="info-cell-label">ATK / DEF</div><div class="info-cell-value">${i.atk} / ${i.def}</div></div>
          <div class="info-cell"><div class="info-cell-label">Magic ATK</div><div class="info-cell-value">${i.magic_atk}</div></div>
          <div class="info-cell"><div class="info-cell-label">Crit Rate</div><div class="info-cell-value">${(i.crit_rate*100).toFixed(0)}%</div></div>
        </div>
        <div class="card" style="margin:0">
          <div class="card-header"><div class="card-title">${m(`package`)} Inventori (${r.inventory.length})</div></div>
          <div class="card-body" style="display:flex;flex-wrap:wrap;gap:6px">${c}</div>
        </div>
      </div>`;n(`${m(`swords`)} ${i.class_name} Lv.${i.level}`,l,`
      <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
      <button class="btn btn-yellow" id="rpg-setlevel">Set Level</button>
      <button class="btn btn-yellow" id="rpg-setgold">Set Gold</button>
      <button class="btn btn-danger" id="rpg-reset">Hapus RPG</button>`),window.lucide&&lucide.createIcons({scope:document.getElementById(`modal-overlay`)}),document.getElementById(`rpg-setlevel`).onclick=()=>f(e),document.getElementById(`rpg-setgold`).onclick=()=>p(e),document.getElementById(`rpg-reset`).onclick=async()=>{window.confirm(`Hapus seluruh data RPG?`)&&(await t.post(`/api/rpg-users/${e}/reset`),a(`RPG dihapus`),o())}}catch(e){a(e.message,`error`),o()}}function f(e){n(`Set Level`,`<div class="form-row"><input class="form-control" type="number" id="new-level" min="1" max="999" placeholder="Level (1-999)"></div>`,`<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="sl-save">Simpan</button>`),document.getElementById(`sl-save`).onclick=async()=>{let n=parseInt(document.getElementById(`new-level`)?.value);if(!n||n<1||n>999){a(`Level tidak valid`,`error`);return}await t.post(`/api/rpg-users/${e}/set-level`,{level:n}),a(`Level diset ke ${n}`),o()}}function p(e){n(`Set Gold`,`<div class="form-row"><input class="form-control" type="number" id="new-gold" min="0" placeholder="Jumlah gold"></div>`,`<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="sg-save">Simpan</button>`),document.getElementById(`sg-save`).onclick=async()=>{let n=parseInt(document.getElementById(`new-gold`)?.value);if(isNaN(n)||n<0){a(`Gold tidak valid`,`error`);return}await t.post(`/api/rpg-users/${e}/set-gold`,{gold:n}),a(`Gold diset ke ${n}`),o()}}function m(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function h(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}s((()=>{r(),i()}))();export{l as cleanup,c as render};