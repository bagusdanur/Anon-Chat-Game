import{a as e,c as t,l as n,r,u as i}from"./index-CMn0ttVB.js";async function a(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${c(`scroll-text`)} Quests</div>
      <button class="btn btn-outline btn-sm" id="q-refresh">${c(`refresh-cw`)}</button>
    </div>
    <div id="q-table">${e(5)}</div>
  </div></div>`,document.getElementById(`q-refresh`).onclick=()=>s(t),await s(t)}function o(){}async function s(e){let n=document.getElementById(`q-table`);if(n)try{let r=await t.get(`/api/quests`);if(e.querySelector(`.card-title`).innerHTML=`${c(`scroll-text`)} Quests (${r.length})`,!r.length){n.innerHTML=`<div class="empty-state">${l(`scroll-text`)}<p>Belum ada quest</p></div>`;return}n.innerHTML=`<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Nama / Deskripsi</th><th>Tipe</th><th>Action</th><th>Target</th><th>Reward</th></tr></thead>
      <tbody>${r.map(e=>`
      <tr>
        <td><code style="font-size:12px">${e.quest_id}</code></td>
        <td><strong>${e.name}</strong><br><span style="font-size:12px;color:var(--muted)">${e.description}</span></td>
        <td><span class="badge badge-blue">${e.type}</span></td>
        <td style="font-size:12px">${e.action_type}</td>
        <td>${e.target_count}</td>
        <td><span class="badge badge-accent">✨${e.xp_reward} XP</span> <span class="badge badge-yellow">💰${e.gold_reward}g</span></td>
      </tr>`).join(``)}</tbody>
    </table></div>`,window.lucide&&lucide.createIcons({scope:e})}catch(e){n.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}function c(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function l(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}i((()=>{n(),r()}))();export{o as cleanup,a as render};