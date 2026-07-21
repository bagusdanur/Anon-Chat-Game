/**
 * dungeons.js — Dungeon runs viewer
 */
import API from '../api.js';
import { skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('castle')} Dungeon Runs</div>
      <button class="btn btn-outline btn-sm" id="dng-refresh">${ic('refresh-cw')}</button>
    </div>
    <div id="dng-table">${skeletonRows(5)}</div>
  </div></div>`;
  document.getElementById('dng-refresh').onclick = () => load(container);
  await load(container);
}

export function cleanup() {}

async function load(container) {
  const el = document.getElementById('dng-table');
  if (!el) return;
  try {
    const data = await API.get('/api/dungeons');
    container.querySelector('.card-title').innerHTML = `${ic('castle')} Dungeon Runs (${data.length})`;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state">${ic48('castle')}<p>Belum ada dungeon run</p></div>`;
      return;
    }

    const resBadge = r => r === 'win' ? 'badge-green' : r === 'lose' ? 'badge-red' : 'badge-yellow';

    const rows = data.map(d => `
      <tr>
        <td><code style="color:var(--accent);font-size:12px">${d.player_a_id}</code></td>
        <td><code style="color:var(--pink);font-size:12px">${d.player_b_id}</code></td>
        <td><code style="font-size:12px">${d.boss_id}</code></td>
        <td><span class="badge ${resBadge(d.result)}">${d.result}</span></td>
        <td style="font-size:12px;color:var(--muted)">${fmtTs(d.started_at)}</td>
      </tr>`).join('');

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Player A</th><th>Player B</th><th>Boss</th><th>Hasil</th><th>Tanggal</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
    if (window.lucide) lucide.createIcons({ scope: container });
  } catch(e) {
    el.innerHTML = `<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function fmtTs(ts) {
  if (!ts) return '-';
  try { return new Date(ts * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch { return ts; }
}
function ic(n)   { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
