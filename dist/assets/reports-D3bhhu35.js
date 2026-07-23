import{a as e,c as t,l as n,n as r,r as i,s as a,u as o}from"./index-DygV-4TP.js";async function s(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${d(`flag`)} Reports</div>
      <button class="btn btn-outline btn-sm" id="rep-refresh">${d(`refresh-cw`)}</button>
    </div>
    <div id="rep-table">${e(5)}</div>
  </div></div>`,document.getElementById(`rep-refresh`).onclick=()=>l(t),await l(t)}function c(){}async function l(n){let i=document.getElementById(`rep-table`);if(i){i.innerHTML=e(5);try{let e=await t.get(`/api/reports`);if(n.querySelector(`.card-title`).innerHTML=`${d(`flag`)} Reports (${e.length})`,!e.length){i.innerHTML=`<div class="empty-state">${f(`check-circle`)}<p>Tidak ada laporan! 🎉</p></div>`;return}i.innerHTML=`<div class="table-wrap"><table>
      <thead><tr><th>Reporter</th><th>Dilaporkan</th><th>Alasan</th><th>Tanggal</th><th>Aksi</th></tr></thead>
      <tbody>${e.map(e=>`
      <tr>
        <td><code style="color:var(--accent);font-size:12px">${e.reporter_id}</code></td>
        <td><code style="color:var(--red);font-size:12px">${e.reported_id}</code></td>
        <td style="max-width:200px">${e.reason||`<span style="color:var(--muted)">-</span>`}</td>
        <td style="font-size:12px;color:var(--muted)">${u(e.created_at)}</td>
        <td class="td-actions">
          <button class="btn btn-success btn-sm" data-ban="${e.reported_id}">${d(`ban`)} Ban</button>
          <button class="btn btn-danger btn-sm" data-del="${e.id}">${d(`trash-2`)}</button>
        </td>
      </tr>`).join(``)}</tbody>
    </table></div>`,i.querySelectorAll(`[data-del]`).forEach(e=>{e.onclick=()=>r(`Hapus laporan ini?`,async()=>{await t.del(`/api/reports/${e.dataset.del}`),a(`Laporan dihapus`),l(n)})}),i.querySelectorAll(`[data-ban]`).forEach(e=>{e.onclick=()=>r(`Ban user <code>${e.dataset.ban}</code>?`,async()=>{await t.post(`/api/users/${e.dataset.ban}/ban`),a(`User ${e.dataset.ban} di-ban`,`success`),l(n)})}),window.lucide&&lucide.createIcons({scope:n})}catch(e){i.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}}function u(e){if(!e)return`-`;try{return new Date(e).toLocaleString(`id-ID`,{dateStyle:`short`,timeStyle:`short`})}catch{return e}}function d(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function f(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}o((()=>{n(),i()}))();export{c as cleanup,s as render};