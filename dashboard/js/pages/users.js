/**
 * users.js — User management page
 */
import API from '../api.js';
import { toast, openModal, closeModal, confirm, skeletonRows } from '../components.js';

let _allUsers = [];

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${icon('users')} Users</div>
      <button class="btn btn-outline btn-sm" id="users-refresh">${icon('refresh-cw')} Refresh</button>
    </div>
    <div class="form-row" style="align-items:center">
      <input class="form-control" id="u-search" placeholder="Cari Chat ID, lang, gender…" style="flex:1;min-width:180px">
      <select class="form-control" id="u-status" style="width:140px">
        <option value="">Semua Status</option>
        <option value="idle">Idle</option>
        <option value="queued">Queued</option>
        <option value="chatting">Chatting</option>
      </select>
      <select class="form-control" id="u-ban" style="width:130px">
        <option value="">Semua</option>
        <option value="0">Aktif</option>
        <option value="1">Banned</option>
      </select>
    </div>
    <div id="users-table">${skeletonRows(8)}</div>
  </div></div>`;

  document.getElementById('users-refresh').onclick = () => loadUsers(container);
  document.getElementById('u-search').oninput = debounce(filterUsers, 250);
  document.getElementById('u-status').onchange = filterUsers;
  document.getElementById('u-ban').onchange = filterUsers;

  await loadUsers(container);
  if (window.lucide) lucide.createIcons({ scope: container });
}

export function cleanup() {}

async function loadUsers(container) {
  const el = document.getElementById('users-table');
  if (!el) return;
  el.innerHTML = skeletonRows(8);
  try {
    _allUsers = await API.get('/api/users');
    document.getElementById('users-table').closest('.card').querySelector('.card-title').innerHTML =
      `${icon('users')} Users (${_allUsers.length})`;
    renderTable(_allUsers);
    if (window.lucide) lucide.createIcons({ scope: container });
  } catch(e) {
    el.innerHTML = `<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function filterUsers() {
  const q  = (document.getElementById('u-search')?.value || '').toLowerCase();
  const st = document.getElementById('u-status')?.value || '';
  const bn = document.getElementById('u-ban')?.value;

  let data = _allUsers;
  if (q)  data = data.filter(u => String(u.chat_id).includes(q) || (u.lang||'').includes(q) || (u.gender||'').includes(q));
  if (st) data = data.filter(u => u.status === st);
  if (bn !== undefined && bn !== '') data = data.filter(u => u.is_banned === +bn);

  renderTable(data);
  if (window.lucide) lucide.createIcons({ scope: document.getElementById('users-table') });
}

function renderTable(data) {
  const el = document.getElementById('users-table');
  if (!el) return;

  if (!data.length) {
    el.innerHTML = `<div class="empty-state">${icon48('users')}<p>Tidak ada user ditemukan</p></div>`;
    return;
  }

  const rows = data.map(u => {
    const stBadge = u.status === 'chatting' ? 'badge-green'
                  : u.status === 'queued'   ? 'badge-yellow'
                  : 'badge-gray';
    const stIcon  = u.status === 'chatting' ? 'heart'
                  : u.status === 'queued'   ? 'clock'
                  : 'user';
    return `<tr data-clickable data-id="${u.chat_id}">
      <td><code style="color:var(--accent);font-size:12px">${u.chat_id}</code></td>
      <td><span class="badge ${stBadge}">${icon(stIcon)} ${u.status}</span></td>
      <td>${u.lang || 'any'}</td>
      <td>${u.gender || '-'}</td>
      <td>${u.is_banned
        ? `<span class="badge badge-red">${icon('ban')} Banned</span>`
        : `<span class="badge badge-gray">OK</span>`}</td>
      <td style="font-size:12px;color:var(--muted)">${fmtDate(u.created_at)}</td>
      <td onclick="event.stopPropagation()" class="td-actions">
        ${u.is_banned
          ? `<button class="btn btn-success btn-sm" data-action="unban" data-id="${u.chat_id}">${icon('check')}</button>`
          : `<button class="btn btn-danger btn-sm" data-action="ban" data-id="${u.chat_id}">${icon('ban')}</button>`}
        <button class="btn btn-blue btn-sm" data-action="send" data-id="${u.chat_id}">${icon('send')}</button>
      </td>
    </tr>`;
  }).join('');

  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr>
      <th>Chat ID</th><th>Status</th><th>Lang</th><th>Gender</th><th>Ban</th><th>Bergabung</th><th>Aksi</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;

  // Event delegation
  el.querySelectorAll('[data-action]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      if (action === 'ban')    banUser(id);
      if (action === 'unban')  unbanUser(id);
      if (action === 'send')   sendMsgModal(id);
    };
  });
  el.querySelectorAll('[data-clickable]').forEach(row => {
    row.onclick = () => userDetailModal(row.dataset.id);
  });
}

async function banUser(id) {
  confirm(`Ban user <code>${id}</code>?`, async () => {
    try {
      await API.post(`/api/users/${id}/ban`);
      toast('User berhasil di-ban', 'success');
      const u = _allUsers.find(x => x.chat_id == id);
      if (u) u.is_banned = 1;
      filterUsers();
      if (window.lucide) lucide.createIcons({ scope: document.getElementById('users-table') });
    } catch(e) { toast(e.message, 'error'); }
  });
}

async function unbanUser(id) {
  try {
    await API.post(`/api/users/${id}/unban`);
    toast('User di-unban', 'success');
    const u = _allUsers.find(x => x.chat_id == id);
    if (u) u.is_banned = 0;
    filterUsers();
    if (window.lucide) lucide.createIcons({ scope: document.getElementById('users-table') });
  } catch(e) { toast(e.message, 'error'); }
}

async function userDetailModal(id) {
  openModal(`${icon('user')} User: ${id}`,
    `<div style="display:flex;align-items:center;gap:10px;padding:20px"><div class="skeleton" style="height:14px;flex:1"></div></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Tutup</button>`
  );
  try {
    const d = await API.get(`/api/users/${id}`);
    const u = d.user, rpg = d.rpg;
    const html = `
      <div style="display:flex;flex-direction:column;gap:12px">
        <div class="info-grid">
          <div class="info-cell"><div class="info-cell-label">Chat ID</div><div class="info-cell-value"><code>${u.chat_id}</code></div></div>
          <div class="info-cell"><div class="info-cell-label">Status</div><div class="info-cell-value">${u.status}</div></div>
          <div class="info-cell"><div class="info-cell-label">Bahasa</div><div class="info-cell-value">${u.lang || 'any'}</div></div>
          <div class="info-cell"><div class="info-cell-label">Gender</div><div class="info-cell-value">${u.gender || 'any'}</div></div>
          <div class="info-cell"><div class="info-cell-label">Status Ban</div><div class="info-cell-value">${u.is_banned ? '<span class="badge badge-red">Banned</span>' : '<span class="badge badge-gray">Aktif</span>'}</div></div>
          <div class="info-cell"><div class="info-cell-label">Bergabung</div><div class="info-cell-value" style="font-size:12px">${fmtDate(u.created_at)}</div></div>
        </div>
        ${rpg ? `<div class="card" style="margin:0"><div class="card-header"><div class="card-title">${icon('swords')} RPG Character</div></div>
          <div class="card-body">
            <div class="info-grid">
              <div class="info-cell"><div class="info-cell-label">Class</div><div class="info-cell-value">${rpg.class_name}</div></div>
              <div class="info-cell"><div class="info-cell-label">Level</div><div class="info-cell-value">Lv.${rpg.level}</div></div>
              <div class="info-cell"><div class="info-cell-label">Gold</div><div class="info-cell-value">${rpg.gold}g</div></div>
              <div class="info-cell"><div class="info-cell-label">HP</div><div class="info-cell-value">${rpg.hp}/${rpg.max_hp}</div></div>
            </div>
          </div></div>` : `<p style="color:var(--muted);font-size:13px">Tidak ada karakter RPG</p>`}
        ${d.reports?.length ? `<div class="card" style="margin:0"><div class="card-header"><div class="card-title">${icon('flag')} Reports Terkait</div></div>
          <div class="card-body" style="font-size:12px">${d.reports.map(r =>
            `<div style="padding:6px 0;border-bottom:1px solid var(--border-dark)">${fmtDate(r.created_at)} — ${r.reason||'-'}</div>`
          ).join('')}</div></div>` : ''}
      </div>`;
    const footer = `
      <button class="btn btn-outline" onclick="closeModal()">Tutup</button>
      <button class="btn btn-yellow" id="um-reset">Reset Status</button>
      ${u.is_banned
        ? `<button class="btn btn-success" id="um-unban">Unban</button>`
        : `<button class="btn btn-danger" id="um-ban">Ban</button>`}
      ${rpg ? `<button class="btn btn-danger" id="um-rpgdel">Hapus RPG</button>` : ''}`;
    openModal(`${icon('user')} User: ${id}`, html, footer);
    if (window.lucide) lucide.createIcons({ scope: document.getElementById('modal-overlay') });
    document.getElementById('um-reset')?.addEventListener('click', async () => {
      await API.post(`/api/users/${id}/reset`); toast('Status direset'); closeModal();
      const u2 = _allUsers.find(x => x.chat_id == id); if(u2) u2.status='idle'; filterUsers();
    });
    document.getElementById('um-ban')?.addEventListener('click', () => { closeModal(); banUser(id); });
    document.getElementById('um-unban')?.addEventListener('click', () => { closeModal(); unbanUser(id); });
    document.getElementById('um-rpgdel')?.addEventListener('click', async () => {
      if (!window.confirm('Hapus data RPG user ini?')) return;
      await API.post(`/api/rpg-users/${id}/reset`); toast('RPG dihapus'); closeModal();
    });
  } catch(e) { toast(e.message, 'error'); closeModal(); }
}

function sendMsgModal(id) {
  openModal(`${icon('send')} Kirim ke ${id}`,
    `<div class="form-row"><textarea class="form-control" id="sendMsg-text" placeholder="Pesan untuk user…"></textarea></div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="sendMsg-btn">${icon('send')} Kirim</button>`
  );
  document.getElementById('sendMsg-btn').onclick = async () => {
    const msg = document.getElementById('sendMsg-text')?.value?.trim();
    if (!msg) return;
    try {
      await API.post('/api/send', { chat_id: id, message: msg });
      toast('Pesan terkirim!'); closeModal();
    } catch(e) { toast(e.message, 'error'); }
  };
}

// Utils
function icon(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${name}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`;
}
function icon48(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${name}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`;
}
function fmtDate(d) {
  if (!d) return '-';
  try { return new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }); }
  catch { return d; }
}
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
