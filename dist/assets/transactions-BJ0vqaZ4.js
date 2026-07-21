import{a as e,c as t,l as n,r,u as i}from"./index-CQ80I5cs.js";async function a(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${l(`coins`)} Transactions</div>
      <button class="btn btn-outline btn-sm" id="tx-refresh">${l(`refresh-cw`)}</button>
    </div>
    <div id="tx-table">${e(6)}</div>
  </div></div>`,document.getElementById(`tx-refresh`).onclick=()=>s(t),await s(t)}function o(){}async function s(e){let n=document.getElementById(`tx-table`);if(n)try{let r=await t.get(`/api/transactions`);if(e.querySelector(`.card-title`).innerHTML=`${l(`coins`)} Transactions (${r.length})`,!r.length){n.innerHTML=`<div class="empty-state">${u(`coins`)}<p>Belum ada transaksi</p></div>`;return}n.innerHTML=`<div class="table-wrap"><table>
      <thead><tr><th>Dari</th><th>Ke</th><th>Jumlah</th><th>Alasan</th><th>Tanggal</th></tr></thead>
      <tbody>${r.map(e=>`
      <tr>
        <td><code style="color:var(--accent);font-size:12px">${e.from_user_id||`-`}</code></td>
        <td><code style="color:var(--pink);font-size:12px">${e.to_user_id||`-`}</code></td>
        <td><strong>${e.amount}g</strong></td>
        <td><span class="badge badge-blue">${e.reason}</span></td>
        <td style="font-size:12px;color:var(--muted)">${c(e.created_at)}</td>
      </tr>`).join(``)}</tbody>
    </table></div>`,window.lucide&&lucide.createIcons({scope:e})}catch(e){n.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}function c(e){if(!e)return`-`;try{return new Date(e*1e3).toLocaleString(`id-ID`,{dateStyle:`short`,timeStyle:`short`})}catch{return e}}function l(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function u(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}i((()=>{n(),r()}))();export{o as cleanup,a as render};