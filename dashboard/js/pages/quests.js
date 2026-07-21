/**
 * quests.js — Quests viewer
 */
import API from '../api.js';
import { skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('scroll-text')} Quests</div>
      <button class="btn btn-outline btn-sm" id="q-refresh">${ic('refresh-cw')}</button>
    </div>
    <div id="q-table">${skeletonRows(5)}</div>
  </div></div>`;
  document.getElementById('q-refresh').onclick = () => load(container);
  await load(container);
}

export function cleanup() {}

async function load(container) {
  const el = document.getElementById('q-table');
  if (!el) return;
  try {
    const data = await API.get('/api/quests');
    container.querySelector('.card-title').innerHTML = `${ic('scroll-text')} Quests (${data.length})`;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state">${ic48('scroll-text')}<p>Belum ada quest</p></div>`;
      return;
    }

    const rows = data.map(q => `
      <tr>
        <td><code style="font-size:12px">${q.quest_id}</code></td>
        <td><strong>${q.name}</strong><br><span style="font-size:12px;color:var(--muted)">${q.description}</span></td>
        <td><span class="badge badge-blue">${q.type}</span></td>
        <td style="font-size:12px">${q.action_type}</td>
        <td>${q.target_count}</td>
        <td><span class="badge badge-accent">✨${q.xp_reward} XP</span> <span class="badge badge-yellow">💰${q.gold_reward}g</span></td>
      </tr>`).join('');

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Nama / Deskripsi</th><th>Tipe</th><th>Action</th><th>Target</th><th>Reward</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    if (window.lucide) lucide.createIcons({ scope: container });
  } catch(e) {
    el.innerHTML = `<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function ic(n)   { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
