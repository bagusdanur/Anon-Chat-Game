import{a as e,c as t,l as n,r,u as i}from"./index-BzmntqLX.js";async function a(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${l(`castle`)} Dungeon Runs</div>
      <button class="btn btn-outline btn-sm" id="dng-refresh">${l(`refresh-cw`)}</button>
    </div>
    <div id="dng-table">${e(5)}</div>
  </div></div>`,document.getElementById(`dng-refresh`).onclick=()=>s(t),await s(t)}function o(){}async function s(e){let n=document.getElementById(`dng-table`);if(n)try{let r=await t.get(`/api/dungeons`);if(e.querySelector(`.card-title`).innerHTML=`${l(`castle`)} Dungeon Runs (${r.length})`,!r.length){n.innerHTML=`<div class="empty-state">${u(`castle`)}<p>Belum ada dungeon run</p></div>`;return}let i=e=>e===`win`?`badge-green`:e===`lose`?`badge-red`:`badge-yellow`;n.innerHTML=`<div class="table-wrap"><table>
      <thead><tr><th>Player A</th><th>Player B</th><th>Boss</th><th>Hasil</th><th>Tanggal</th></tr></thead>
      <tbody>${r.map(e=>`
      <tr>
        <td><code style="color:var(--accent);font-size:12px">${e.player_a_id}</code></td>
        <td><code style="color:var(--pink);font-size:12px">${e.player_b_id}</code></td>
        <td><code style="font-size:12px">${e.boss_id}</code></td>
        <td><span class="badge ${i(e.result)}">${e.result}</span></td>
        <td style="font-size:12px;color:var(--muted)">${c(e.started_at)}</td>
      </tr>`).join(``)}</tbody>
    </table></div>`,window.lucide&&lucide.createIcons({scope:e})}catch(e){n.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}function c(e){if(!e)return`-`;try{return new Date(e*1e3).toLocaleString(`id-ID`,{dateStyle:`short`,timeStyle:`short`})}catch{return e}}function l(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function u(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}i((()=>{n(),r()}))();export{o as cleanup,a as render};