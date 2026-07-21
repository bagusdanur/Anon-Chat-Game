/**
 * app.js — Main application logic, router, and shell setup
 */
import API from './api.js';
import { toast, openModal, closeModal } from './components.js';

// Page modules map
const pages = {
  home:         () => import('./pages/home.js'),
  users:        () => import('./pages/users.js'),
  rpg:          () => import('./pages/rpg.js'),
  items:        () => import('./pages/items.js'),
  quests:       () => import('./pages/quests.js'),
  reports:      () => import('./pages/reports.js'),
  duels:        () => import('./pages/duels.js'),
  dungeons:     () => import('./pages/dungeons.js'),
  transactions: () => import('./pages/transactions.js'),
  wordfilter:   () => import('./pages/wordfilter.js'),
  icebreakers:  () => import('./pages/icebreakers.js'),
  logs:         () => import('./pages/logs.js'),
  maintenance:  () => import('./pages/maintenance.js'),
};

let currentPage = null;

export async function init() {
  if (!API.isAuth) {
    showLoginView();
    return;
  }
  await showAppView();
}

/* ============================================================
   VIEWS
   ============================================================ */
function showLoginView() {
  document.getElementById('app-view').style.display = 'none';
  const loginView = document.getElementById('login-view');
  loginView.style.display = 'flex';

  const btn = document.getElementById('btn-login');
  const input = document.getElementById('login-pass');
  
  const doLogin = async () => {
    const pass = input.value;
    if (!pass) return;
    
    btn.disabled = true;
    const oldText = btn.innerHTML;
    btn.innerHTML = `<svg class="pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg> Loading…`;
    
    const ok = await API.login(pass);
    if (ok) {
      loginView.style.display = 'none';
      await showAppView();
    } else {
      btn.disabled = false;
      btn.innerHTML = oldText;
      const err = document.getElementById('login-error');
      err.style.display = 'flex';
      setTimeout(() => err.style.display = 'none', 3000);
    }
  };

  btn.onclick = doLogin;
  input.onkeypress = e => { if (e.key === 'Enter') doLogin(); };
}

async function showAppView() {
  document.getElementById('login-view').style.display = 'none';
  document.getElementById('app-view').style.display = 'flex';
  
  setupShell();
  
  // Expose global for quick actions in home.js
  window.appNav = navigate;
  window.triggerBroadcast = broadcastModal;
  
  // Listen for unauthorized (token expired/invalid)
  window.addEventListener('api:unauthorized', () => {
    toast('Sesi berakhir, silakan login kembali', 'warning');
    if (currentPage && currentPage.cleanup) currentPage.cleanup();
    showLoginView();
  });

  // Handle routing
  window.addEventListener('hashchange', () => navigateFromHash());
  navigateFromHash();
  
  // Initial stats for sidebar
  try {
    const s = await API.get('/api/stats');
    document.getElementById('nav-users-count').textContent = s.totalUsers;
  } catch(e) {}
}

/* ============================================================
   ROUTING
   ============================================================ */
function navigateFromHash() {
  let hash = window.location.hash.replace('#/', '');
  if (!hash || !pages[hash]) hash = 'home';
  navigate(hash);
}

async function navigate(pageName) {
  if (!pages[pageName]) pageName = 'home';
  window.location.hash = '/' + pageName;
  
  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageName);
  });
  
  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');

  const main = document.getElementById('main-content');
  
  // Cleanup previous page
  if (currentPage && currentPage.cleanup) {
    currentPage.cleanup();
  }
  
  main.innerHTML = `
    <div style="display:flex;justify-content:center;padding:40px;opacity:0.5">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
    </div>`;

  try {
    const mod = await pages[pageName]();
    currentPage = mod;
    await mod.render(main);
  } catch(e) {
    main.innerHTML = `<div class="card"><div class="card-body" style="color:var(--red)">Gagal memuat halaman: ${e.message}</div></div>`;
  }
}

/* ============================================================
   SHELL SETUP (Sidebar, Header, Modals)
   ============================================================ */
function setupShell() {
  // Sidebar Toggle
  const sb = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  document.getElementById('btn-menu').onclick = () => {
    sb.classList.add('open');
    overlay.classList.add('show');
  };
  overlay.onclick = () => {
    sb.classList.remove('open');
    overlay.classList.remove('show');
  };

  // Header Actions
  document.getElementById('btn-broadcast').onclick = broadcastModal;
  
  document.getElementById('btn-logout').onclick = () => {
    API.token = null;
    if (currentPage && currentPage.cleanup) currentPage.cleanup();
    showLoginView();
  };
  
  document.getElementById('btn-backup').onclick = async () => {
    try {
      await API.download('/api/backup', `bot-backup-${new Date().toISOString().slice(0,10)}.db`);
      toast('Backup berhasil diunduh');
    } catch(e) { toast('Gagal backup: ' + e.message, 'error'); }
  };
}

/* ============================================================
   GLOBAL ACTIONS
   ============================================================ */
function broadcastModal() {
  openModal('📢 Broadcast Global', 
    `<div class="form-group">
      <label class="form-label">Pesan Broadcast</label>
      <textarea class="form-control" id="bc-msg" placeholder="Ketik pesan yang akan dikirim ke semua user aktif…"></textarea>
    </div>
    <div style="font-size:12px;color:var(--muted)">Proses broadcast berjalan di background dan mungkin memakan waktu tergantung jumlah user.</div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-yellow" id="bc-send">
       <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
       Kirim Broadcast
     </button>`
  );
  
  document.getElementById('bc-send').onclick = async () => {
    const msg = document.getElementById('bc-msg')?.value?.trim();
    if (!msg) { toast('Pesan kosong', 'warning'); return; }
    try {
      await API.post('/api/broadcast', { message: msg });
      toast('Broadcast sedang dikirim…');
      closeModal();
    } catch(e) { toast(e.message, 'error'); }
  };
}

// Inline animation
const style = document.createElement('style');
style.textContent = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
document.head.appendChild(style);
