/**
 * logs.js — Bot log viewer
 */
import API from '../api.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('file-text')} Bot Logs <span style="font-size:12px;color:var(--muted);font-weight:500">(last 100 lines)</span></div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" id="log-wrap" style="cursor:pointer"> Wrap
        </label>
        <button class="btn btn-outline btn-sm" id="log-refresh">${ic('refresh-cw')}</button>
      </div>
    </div>
    <div class="log-viewer" id="log-viewer">
      <div style="color:var(--muted);font-size:12px">Memuat log…</div>
    </div>
  </div></div>`;

  document.getElementById('log-refresh').onclick = () => loadLogs();
  document.getElementById('log-wrap').onchange = (e) => {
    const viewer = document.getElementById('log-viewer');
    if (viewer) viewer.style.whiteSpace = e.target.checked ? 'pre-wrap' : 'pre';
  };
  await loadLogs();
  if (window.lucide) lucide.createIcons({ scope: container });
}

export function cleanup() {}

async function loadLogs() {
  const el = document.getElementById('log-viewer');
  if (!el) return;
  try {
    const d = await API.get('/api/logs');
    if (!d.logs?.length) {
      el.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:8px">Tidak ada log tersimpan.</div>`;
      return;
    }

    el.innerHTML = d.logs.map(line => {
      try {
        const obj = JSON.parse(line);
        const date = new Date(obj.time || Date.now());
        const timeStr = date.toLocaleTimeString('id-ID', { hour12: false });
        
        let levelStr = 'INFO';
        let cls = 'info';
        if (obj.level >= 50) { levelStr = 'ERROR'; cls = 'error'; }
        else if (obj.level >= 40) { levelStr = 'WARN'; cls = 'warn'; }
        
        let msgStr = obj.msg || '';
        if (obj.event === 'message_relayed') {
          msgStr = `[message_relayed] from ${obj.from} to ${obj.to}`;
        }
        
        return `<div class="log-line ${cls}"><span style="color:var(--muted)">[${timeStr}]</span> <strong>${levelStr}:</strong> ${escHtml(msgStr)}</div>`;
      } catch (e) {
        // Fallback for non-JSON logs
        const cls = line.includes('ERROR') || line.includes('error') ? 'error'
                  : line.includes('WARN')  || line.includes('warn')  ? 'warn'
                  : line.includes('INFO')  || line.includes('info')  ? 'info'
                  : '';
        return `<div class="log-line ${cls}">${escHtml(line)}</div>`;
      }
    }).join('');

    // Scroll to bottom
    el.scrollTop = el.scrollHeight;
  } catch(e) {
    el.innerHTML = `<div style="color:var(--red);font-size:12px">Gagal memuat log: ${e.message}</div>`;
  }
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
function ic(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
