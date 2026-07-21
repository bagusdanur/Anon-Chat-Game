/**
 * reports.js — Reports management
 */
import API from '../api.js';
import { toast, confirm, skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('flag')} Reports</div>
      <button class="btn btn-outline btn-sm" id="rep-refresh">${ic('refresh-cw')}</button>
    </div>
    <div id="rep-table">${skeletonRows(5)}</div>
  </div></div>`;
  document.getElementById('rep-refresh').onclick = () => load(container);
  await load(container);
}

export function cleanup() {}

async function load(container) {
  const el = document.getElementById('rep-table');
  if (!el) return;
  el.innerHTML = skeletonRows(5);
  try {
    const data = await API.get('/api/reports');
    container.querySelector('.card-title').innerHTML = `${ic('flag')} Reports (${data.length})`;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state">${ic48('check-circle')}<p>Tidak ada laporan! 🎉</p></div>`;
      return;
    }

    const rows = data.map(r => `
      <tr>
        <td><code style="color:var(--accent);font-size:12px">${r.reporter_id}</code></td>
        <td><code style="color:var(--red);font-size:12px">${r.reported_id}</code></td>
        <td style="max-width:200px">${r.reason || '<span style="color:var(--muted)">-</span>'}</td>
        <td style="font-size:12px;color:var(--muted)">${fmtDate(r.created_at)}</td>
        <td class="td-actions">
          <button class="btn btn-success btn-sm" data-ban="${r.reported_id}">${ic('ban')} Ban</button>
          <button class="btn btn-danger btn-sm" data-del="${r.id}">${ic('trash-2')}</button>
        </td>
      </tr>`).join('');

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Reporter</th><th>Dilaporkan</th><th>Alasan</th><th>Tanggal</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

    el.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => confirm('Hapus laporan ini?', async () => {
        await API.del(`/api/reports/${btn.dataset.del}`);
        toast('Laporan dihapus'); load(container);
      });
    });
    el.querySelectorAll('[data-ban]').forEach(btn => {
      btn.onclick = () => confirm(`Ban user <code>${btn.dataset.ban}</code>?`, async () => {
        await API.post(`/api/users/${btn.dataset.ban}/ban`);
        toast(`User ${btn.dataset.ban} di-ban`, 'success');
        load(container);
      });
    });
    if (window.lucide) lucide.createIcons({ scope: container });
  } catch(e) {
    el.innerHTML = `<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function fmtDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); } catch { return d; }
}
function ic(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
