/**
 * maintenance.js — Maintenance mode control
 */
import API from '../api.js';
import { toast } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('wrench')} Maintenance Mode</div>
      <span id="maint-badge"></span>
    </div>
    <div class="card-body" id="maint-body">
      <div style="padding:20px"><div class="skeleton" style="height:80px"></div></div>
    </div>
  </div></div>`;
  await load(container);
  if (window.lucide) lucide.createIcons({ scope: container });
}

export function cleanup() {}

async function load(container) {
  try {
    const d = await API.get('/api/maintenance');
    const isOn = d.enabled;

    const badge = document.getElementById('maint-badge');
    if (badge) badge.innerHTML = isOn
      ? `<span class="badge badge-red">${ic('alert-triangle')} MAINTENANCE ON</span>`
      : `<span class="badge badge-green">${ic('check-circle')} BOT AKTIF</span>`;
    if (window.lucide) lucide.createIcons({ scope: badge });

    const body = document.getElementById('maint-body');
    if (!body) return;
    body.innerHTML = `
      <div class="maintenance-banner ${isOn ? 'on' : 'off'}" style="margin-bottom:20px">
        <div style="font-size:40px;margin-bottom:6px">${isOn ? '🔴' : '🟢'}</div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">
          <span class="pulse ${isOn ? 'red' : 'green'}"></span>
          ${isOn ? 'MAINTENANCE MODE AKTIF' : 'BOT BERJALAN NORMAL'}
        </div>
        <div style="font-size:13px;color:var(--muted)">
          ${isOn ? 'User tidak bisa menggunakan bot. Admin tetap bisa akses.' : 'Semua fitur bot berjalan normal.'}
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:20px">
        <button class="btn ${isOn ? 'btn-success' : 'btn-danger'} btn-lg btn-full" id="maint-toggle">
          ${isOn
            ? `${ic('play')} Nonaktifkan Maintenance`
            : `${ic('power')} Aktifkan Maintenance`}
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">Pesan Maintenance</label>
        <textarea class="form-control" id="maint-msg" style="min-height:100px">${d.message || ''}</textarea>
      </div>
      <button class="btn btn-primary" id="maint-save">${ic('save')} Simpan Pesan</button>`;

    if (window.lucide) lucide.createIcons({ scope: body });

    document.getElementById('maint-toggle').onclick = async () => {
      const msg = document.getElementById('maint-msg')?.value?.trim() || d.message;
      await API.post('/api/maintenance', { enabled: !isOn, message: msg });
      toast(isOn ? '🟢 Maintenance dinonaktifkan!' : '🔴 Maintenance diaktifkan!', isOn ? 'success' : 'warning');
      load(container);
    };

    document.getElementById('maint-save').onclick = async () => {
      const msg = document.getElementById('maint-msg')?.value?.trim();
      if (!msg) { toast('Pesan tidak boleh kosong', 'warning'); return; }
      await API.post('/api/maintenance', { enabled: isOn, message: msg });
      toast('Pesan maintenance disimpan');
    };

  } catch(e) {
    document.getElementById('maint-body').innerHTML = `<div style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function ic(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
