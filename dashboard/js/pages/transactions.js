/**
 * transactions.js — Transaction log viewer
 */
import API from '../api.js';
import { skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('coins')} Transactions</div>
      <button class="btn btn-outline btn-sm" id="tx-refresh">${ic('refresh-cw')}</button>
    </div>
    <div id="tx-table">${skeletonRows(6)}</div>
  </div></div>`;
  document.getElementById('tx-refresh').onclick = () => load(container);
  await load(container);
}

export function cleanup() {}

async function load(container) {
  const el = document.getElementById('tx-table');
  if (!el) return;
  try {
    const data = await API.get('/api/transactions');
    container.querySelector('.card-title').innerHTML = `${ic('coins')} Transactions (${data.length})`;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state">${ic48('coins')}<p>Belum ada transaksi</p></div>`;
      return;
    }

    const rows = data.map(t => `
      <tr>
        <td><code style="color:var(--accent);font-size:12px">${t.from_user_id || '-'}</code></td>
        <td><code style="color:var(--pink);font-size:12px">${t.to_user_id || '-'}</code></td>
        <td><strong>${t.amount}g</strong></td>
        <td><span class="badge badge-blue">${t.reason}</span></td>
        <td style="font-size:12px;color:var(--muted)">${fmtTs(t.created_at)}</td>
      </tr>`).join('');

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Dari</th><th>Ke</th><th>Jumlah</th><th>Alasan</th><th>Tanggal</th></tr></thead>
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
