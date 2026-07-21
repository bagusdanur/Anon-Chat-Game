/**
 * rpg.js — RPG Players management
 */
import API from '../api.js';
import { toast, openModal, closeModal, skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('swords')} RPG Players</div>
      <button class="btn btn-outline btn-sm" id="rpg-refresh">${ic('refresh-cw')}</button>
    </div>
    <div id="rpg-table">${skeletonRows(8)}</div>
  </div></div>`;

  document.getElementById('rpg-refresh').onclick = () => load(container);
  await load(container);
}

export function cleanup() {}

async function load(container) {
  const el = document.getElementById('rpg-table');
  if (!el) return;
  el.innerHTML = skeletonRows(8);
  try {
    const data = await API.get('/api/rpg-users');
    container.querySelector('.card-title').innerHTML = `${ic('swords')} RPG Players (${data.length})`;

    if (!data.length) {
      el.innerHTML = `<div class="empty-state">${ic48('swords')}<p>Belum ada RPG player</p></div>`;
      return;
    }

    const classIcon  = c => c === 'ksatria' ? '⚔️' : c === 'penyihir' ? '🔮' : '🗡️';
    const classBadge = c => c === 'ksatria' ? 'badge-blue' : c === 'penyihir' ? 'badge-accent' : 'badge-yellow';

    const rows = data.map(u => `
      <tr data-clickable data-id="${u.telegram_user_id}">
        <td><code style="color:var(--accent);font-size:12px">${u.telegram_user_id}</code></td>
        <td><span class="badge ${classBadge(u.class_name)}">${classIcon(u.class_name)} ${u.class_name}</span></td>
        <td><strong>Lv.${u.level}</strong></td>
        <td>${u.xp.toLocaleString()} XP</td>
        <td>💰 ${u.gold.toLocaleString()}g</td>
        <td>❤️ ${u.hp}/${u.max_hp}</td>
        <td>⚔️${u.atk} 🛡️${u.def}</td>
      </tr>`).join('');

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>ID</th><th>Class</th><th>Level</th><th>XP</th><th>Gold</th><th>HP</th><th>Stats</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

    el.querySelectorAll('[data-clickable]').forEach(row => {
      row.onclick = () => detailModal(row.dataset.id);
    });
    if (window.lucide) lucide.createIcons({ scope: container });
  } catch(e) {
    el.innerHTML = `<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

async function detailModal(id) {
  openModal(`${ic('swords')} RPG Detail: ${id}`, `<div style="padding:20px"><div class="skeleton" style="height:14px"></div></div>`, '');
  try {
    const d = await API.get(`/api/rpg-users/${id}`);
    const u = d.user;
    const rarityBadge = r => r === 'legendary' ? 'badge-orange' : r === 'epic' ? 'badge-accent' : r === 'rare' ? 'badge-blue' : r === 'uncommon' ? 'badge-green' : 'badge-gray';
    const invHTML = d.inventory.length
      ? d.inventory.map(i => `<span class="badge ${rarityBadge(i.rarity)}">${i.display_name}${i.equipped?' ⚡':''} x${i.quantity}</span>`).join(' ')
      : `<span style="color:var(--muted)">Inventori kosong</span>`;

    const html = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="info-grid">
          <div class="info-cell"><div class="info-cell-label">Class</div><div class="info-cell-value">${u.class_name}</div></div>
          <div class="info-cell"><div class="info-cell-label">Level</div><div class="info-cell-value">Lv.${u.level}</div></div>
          <div class="info-cell"><div class="info-cell-label">XP</div><div class="info-cell-value">${u.xp.toLocaleString()}</div></div>
          <div class="info-cell"><div class="info-cell-label">Gold</div><div class="info-cell-value">${u.gold.toLocaleString()}g</div></div>
          <div class="info-cell"><div class="info-cell-label">HP</div><div class="info-cell-value">${u.hp}/${u.max_hp}</div></div>
          <div class="info-cell"><div class="info-cell-label">ATK / DEF</div><div class="info-cell-value">${u.atk} / ${u.def}</div></div>
          <div class="info-cell"><div class="info-cell-label">Magic ATK</div><div class="info-cell-value">${u.magic_atk}</div></div>
          <div class="info-cell"><div class="info-cell-label">Crit Rate</div><div class="info-cell-value">${(u.crit_rate*100).toFixed(0)}%</div></div>
        </div>
        <div class="card" style="margin:0">
          <div class="card-header"><div class="card-title">${ic('package')} Inventori (${d.inventory.length})</div></div>
          <div class="card-body" style="display:flex;flex-wrap:wrap;gap:6px">${invHTML}</div>
        </div>
      </div>`;

    const footer = `
      <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
      <button class="btn btn-yellow" id="rpg-setlevel">Set Level</button>
      <button class="btn btn-yellow" id="rpg-setgold">Set Gold</button>
      <button class="btn btn-danger" id="rpg-reset">Hapus RPG</button>`;

    openModal(`${ic('swords')} ${u.class_name} Lv.${u.level}`, html, footer);
    if (window.lucide) lucide.createIcons({ scope: document.getElementById('modal-overlay') });

    document.getElementById('rpg-setlevel').onclick = () => setLevelModal(id);
    document.getElementById('rpg-setgold').onclick  = () => setGoldModal(id);
    document.getElementById('rpg-reset').onclick    = async () => {
      if (!window.confirm('Hapus seluruh data RPG?')) return;
      await API.post(`/api/rpg-users/${id}/reset`); toast('RPG dihapus'); closeModal();
    };
  } catch(e) { toast(e.message, 'error'); closeModal(); }
}

function setLevelModal(id) {
  openModal('Set Level',
    `<div class="form-row"><input class="form-control" type="number" id="new-level" min="1" max="999" placeholder="Level (1-999)"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="sl-save">Simpan</button>`
  );
  document.getElementById('sl-save').onclick = async () => {
    const lv = parseInt(document.getElementById('new-level')?.value);
    if (!lv || lv < 1 || lv > 999) { toast('Level tidak valid', 'error'); return; }
    await API.post(`/api/rpg-users/${id}/set-level`, { level: lv });
    toast(`Level diset ke ${lv}`); closeModal();
  };
}

function setGoldModal(id) {
  openModal('Set Gold',
    `<div class="form-row"><input class="form-control" type="number" id="new-gold" min="0" placeholder="Jumlah gold"></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="sg-save">Simpan</button>`
  );
  document.getElementById('sg-save').onclick = async () => {
    const g = parseInt(document.getElementById('new-gold')?.value);
    if (isNaN(g) || g < 0) { toast('Gold tidak valid', 'error'); return; }
    await API.post(`/api/rpg-users/${id}/set-gold`, { gold: g });
    toast(`Gold diset ke ${g}`); closeModal();
  };
}

function ic(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
