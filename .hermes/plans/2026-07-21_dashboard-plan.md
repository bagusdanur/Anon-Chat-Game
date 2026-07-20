# Dashboard Admin — Anon-Chat-Game

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Buat web dashboard admin untuk manage bot (users, stats, settings, moderation) via browser.

**Architecture:** Express.js server di port 3001, login page (basic auth), serve static HTML + API endpoints yang query SQLite database yang sama dengan bot.

**Tech Stack:** Express.js, better-sqlite3 (existing), vanilla HTML/CSS/JS (no framework), basic-auth

---

## Task 1: Setup Express Server + Auth

**Objective:** Buat Express server baru di `dashboard.js` dengan basic auth login

**Files:**
- Create: `dashboard.js`
- Modify: `.env` (add `DASHBOARD_PORT`, `DASHBOARD_PASS`)

**Step 1: Add env vars**

```
DASHBOARD_PORT=3001
DASHBOARD_PASS=ryudev2024
```

**Step 2: Create dashboard.js**

```javascript
require('dotenv').config();
const express = require('express');
const path = require('path');
const { db } = require('./src/db');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;
const PASSWORD = process.env.DASHBOARD_PASS || 'admin123';

// Basic auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required');
  }
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');
  if (password === PASSWORD) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
  return res.status(401).send('Invalid credentials');
}

app.use(auth);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

// API: Stats
app.get('/api/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const onlineUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status != 'idle'").get().count;
  const pairedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'chatting'").get().count;
  const queuedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'queued'").get().count;
  const bannedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_banned = 1").get().count;
  const reports24h = db.prepare("SELECT COUNT(*) as count FROM reports WHERE created_at >= datetime('now', '-1 day')").get().count;
  const rpgUsers = db.prepare('SELECT COUNT(*) as count FROM rpg_users').get().count;

  res.json({ totalUsers, onlineUsers, pairedUsers, queuedUsers, bannedUsers, reports24h, rpgUsers });
});

// API: Users list
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
  res.json(users);
});

// API: Ban/Unban
app.post('/api/users/:id/ban', (req, res) => {
  db.prepare('UPDATE users SET is_banned = 1 WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/users/:id/unban', (req, res) => {
  db.prepare('UPDATE users SET is_banned = 0 WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

// API: Reports
app.get('/api/reports', (req, res) => {
  const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50').all();
  res.json(reports);
});

// API: RPG Users
app.get('/api/rpg-users', (req, res) => {
  const users = db.prepare('SELECT * FROM rpg_users ORDER BY level DESC LIMIT 50').all();
  res.json(users);
});

// API: Word Filter
app.get('/api/wordfilter', (req, res) => {
  const { containsBadWord } = require('./src/moderation/wordFilter');
  res.json({ filterExists: typeof containsBadWord === 'function' });
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
```

**Step 3: Test server starts**

Run: `node dashboard.js`
Expected: "Dashboard running at http://localhost:3001"

**Step 4: Commit**

```bash
git add dashboard.js .env
git commit -m "feat: add admin dashboard server with auth"
```

---

## Task 2: Dashboard HTML — Login Page

**Objective:** Buat login page yang minta password sebelum akses dashboard

**Files:**
- Create: `dashboard/index.html`

**Step 1: Create dashboard/index.html**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard — Anon Chat Bot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .login-box { background: #1e293b; padding: 40px; border-radius: 16px; width: 360px; box-shadow: 0 25px 50px rgba(0,0,0,0.5); }
    .login-box h1 { text-align: center; margin-bottom: 8px; font-size: 24px; }
    .login-box p { text-align: center; color: #94a3b8; margin-bottom: 24px; }
    .login-box input { width: 100%; padding: 12px 16px; border: 1px solid #334155; border-radius: 8px; background: #0f172a; color: #e2e8f0; font-size: 16px; margin-bottom: 16px; }
    .login-box input:focus { outline: none; border-color: #6366f1; }
    .login-box button { width: 100%; padding: 12px; border: none; border-radius: 8px; background: #6366f1; color: white; font-size: 16px; font-weight: 600; cursor: pointer; }
    .login-box button:hover { background: #4f46e5; }
    .error { color: #ef4444; text-align: center; margin-top: 12px; display: none; }
  </style>
</head>
<body>
  <div class="login-box">
    <h1>🎭 Admin Dashboard</h1>
    <p>Anon Chat Bot — @anonrpg_bot</p>
    <input type="password" id="password" placeholder="Password" autofocus>
    <button onclick="login()">Login</button>
    <div class="error" id="error">Password salah!</div>
  </div>
  <script>
    async function login() {
      const pass = document.getElementById('password').value;
      try {
        const res = await fetch('/api/stats', {
          headers: { 'Authorization': 'Basic ' + btoa('admin:' + pass) }
        });
        if (res.ok) {
          sessionStorage.setItem('auth', btoa('admin:' + pass));
          window.location.href = '/dashboard.html';
        } else {
          document.getElementById('error').style.display = 'block';
        }
      } catch (e) {
        document.getElementById('error').style.display = 'block';
      }
    }
    document.getElementById('password').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') login();
    });
  </script>
</body>
</html>
```

**Step 2: Test login page**

Open browser → `http://localhost:3001` → should show login page

**Step 3: Commit**

```bash
git add dashboard/index.html
git commit -m "feat: add login page for dashboard"
```

---

## Task 3: Dashboard HTML — Main Panel (Stats + Users)

**Objective:** Buat halaman utama dashboard dengan stats cards dan users table

**Files:**
- Create: `dashboard/dashboard.html`

**Step 1: Create dashboard/dashboard.html**

```html
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard — Anon Chat Bot</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; }
    .header { background: #1e293b; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
    .header h1 { font-size: 20px; }
    .header button { background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { background: #1e293b; padding: 20px; border-radius: 12px; border: 1px solid #334155; }
    .stat-card .label { color: #94a3b8; font-size: 14px; }
    .stat-card .value { font-size: 32px; font-weight: 700; margin-top: 4px; }
    .stat-card .value.green { color: #22c55e; }
    .stat-card .value.blue { color: #3b82f6; }
    .stat-card .value.yellow { color: #eab308; }
    .stat-card .value.red { color: #ef4444; }
    .section { background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 20px; margin-bottom: 24px; }
    .section h2 { margin-bottom: 16px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #334155; }
    th { color: #94a3b8; font-size: 13px; text-transform: uppercase; }
    tr:hover { background: #334155; }
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-green { background: #052e16; color: #22c55e; }
    .badge-red { background: #450a0a; color: #ef4444; }
    .badge-blue { background: #172554; color: #3b82f6; }
    .badge-yellow { background: #422006; color: #eab308; }
    .btn-sm { padding: 4px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
    .btn-ban { background: #ef4444; color: white; }
    .btn-unban { background: #22c55e; color: white; }
    .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
    .tab { padding: 8px 16px; border-radius: 8px; cursor: pointer; background: #334155; border: none; color: #e2e8f0; }
    .tab.active { background: #6366f1; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎭 Admin Dashboard — @anonrpg_bot</h1>
    <button onclick="logout()">Logout</button>
  </div>
  <div class="container">
    <div class="stats" id="stats"></div>
    <div class="tabs">
      <button class="tab active" onclick="showTab('users', this)">Users</button>
      <button class="tab" onclick="showTab('rpg', this)">RPG Players</button>
      <button class="tab" onclick="showTab('reports', this)">Reports</button>
    </div>
    <div class="section" id="content"></div>
  </div>
  <script>
    const auth = sessionStorage.getItem('auth');
    if (!auth) window.location.href = '/';

    const headers = { 'Authorization': 'Basic ' + auth };

    async function loadStats() {
      const res = await fetch('/api/stats', { headers });
      const s = await res.json();
      document.getElementById('stats').innerHTML = `
        <div class="stat-card"><div class="label">Total Users</div><div class="value blue">${s.totalUsers}</div></div>
        <div class="stat-card"><div class="label">Online</div><div class="value green">${s.onlineUsers}</div></div>
        <div class="stat-card"><div class="label">Paired</div><div class="value yellow">${s.pairedUsers}</div></div>
        <div class="stat-card"><div class="label">In Queue</div><div class="value">${s.queuedUsers}</div></div>
        <div class="stat-card"><div class="label">Banned</div><div class="value red">${s.bannedUsers}</div></div>
        <div class="stat-card"><div class="label">Reports (24h)</div><div class="value yellow">${s.reports24h}</div></div>
        <div class="stat-card"><div class="label">RPG Players</div><div class="value blue">${s.rpgUsers}</div></div>
      `;
    }

    async function loadUsers() {
      const res = await fetch('/api/users', { headers });
      const users = await res.json();
      let html = '<table><tr><th>Chat ID</th><th>Status</th><th>Lang</th><th>Gender</th><th>Banned</th><th>Joined</th><th>Action</th></tr>';
      users.forEach(u => {
        const statusBadge = u.status === 'chatting' ? 'badge-green' : u.status === 'queued' ? 'badge-yellow' : 'badge-blue';
        html += `<tr>
          <td><code>${u.chat_id}</code></td>
          <td><span class="badge ${statusBadge}">${u.status}</span></td>
          <td>${u.lang || 'any'}</td>
          <td>${u.gender || 'any'}</td>
          <td>${u.is_banned ? '<span class="badge badge-red">BANNED</span>' : '-'}</td>
          <td>${u.created_at || '-'}</td>
          <td>${u.is_banned
            ? `<button class="btn-sm btn-unban" onclick="unban('${u.chat_id}')">Unban</button>`
            : `<button class="btn-sm btn-ban" onclick="ban('${u.chat_id}')">Ban</button>`
          }</td>
        </tr>`;
      });
      html += '</table>';
      document.getElementById('content').innerHTML = html;
    }

    async function loadRPG() {
      const res = await fetch('/api/rpg-users', { headers });
      const users = await res.json();
      let html = '<table><tr><th>User ID</th><th>Class</th><th>Level</th><th>XP</th><th>Gold</th><th>HP</th></tr>';
      users.forEach(u => {
        html += `<tr>
          <td><code>${u.telegram_user_id}</code></td>
          <td>${u.class_name}</td>
          <td>${u.level}</td>
          <td>${u.xp}</td>
          <td>${u.gold}g</td>
          <td>${u.hp}/${u.max_hp}</td>
        </tr>`;
      });
      html += '</table>';
      document.getElementById('content').innerHTML = html;
    }

    async function loadReports() {
      const res = await fetch('/api/reports', { headers });
      const reports = await res.json();
      let html = '<table><tr><th>Reporter</th><th>Reported</th><th>Reason</th><th>Date</th></tr>';
      reports.forEach(r => {
        html += `<tr>
          <td><code>${r.reporter_id}</code></td>
          <td><code>${r.reported_id}</code></td>
          <td>${r.reason || '-'}</td>
          <td>${r.created_at}</td>
        </tr>`;
      });
      html += '</table>';
      document.getElementById('content').innerHTML = html;
    }

    function showTab(tab, el) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      el.classList.add('active');
      if (tab === 'users') loadUsers();
      else if (tab === 'rpg') loadRPG();
      else if (tab === 'reports') loadReports();
    }

    async function ban(id) {
      await fetch(`/api/users/${id}/ban`, { method: 'POST', headers });
      loadUsers();
    }

    async function unban(id) {
      await fetch(`/api/users/${id}/unban`, { method: 'POST', headers });
      loadUsers();
    }

    function logout() {
      sessionStorage.removeItem('auth');
      window.location.href = '/';
    }

    loadStats();
    loadUsers();
  </script>
</body>
</html>
```

**Step 2: Test dashboard**

Open `http://localhost:3001` → login → should see stats cards + users table with ban/unban buttons

**Step 3: Commit**

```bash
git add dashboard/dashboard.html
git commit -m "feat: add main dashboard panel with stats, users, reports"
```

---

## Task 4: PM2 Setup + Nginx Proxy

**Objective:** Daftarkan dashboard ke PM2 dan akses via port 3001

**Step 1: Start dashboard with PM2**

```bash
cd ~/Anon-Chat-Game
pm2 start dashboard.js --name anon-dashboard
pm2 save
```

**Step 2: Test access**

```bash
curl -u admin:ryudev2024 http://localhost:3001/api/stats
```

Expected: JSON with user stats

**Step 3: Commit**

```bash
git add .env
git commit -m "feat: add dashboard PM2 config"
```

---

## Task 5: Word Filter Manager (Optional Enhancement)

**Objective:** Tambah halaman untuk manage kata terlarang dari dashboard

**Files:**
- Modify: `dashboard.js` (add API endpoints)
- Modify: `dashboard/dashboard.html` (add word filter tab)

**API Endpoints to add:**
- `GET /api/wordfilter` — get current blocklist
- `POST /api/wordfilter` — update blocklist

**Step 1: Add API to dashboard.js**

```javascript
// API: Get word filter
app.get('/api/wordfilter', (req, res) => {
  // Read from a config file or database
  const fs = require('fs');
  const filterPath = path.join(__dirname, 'src/moderation/wordFilter.js');
  const content = fs.readFileSync(filterPath, 'utf8');
  const match = content.match(/const blocklist = \[([^\]]+)\]/);
  if (match) {
    const words = match[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, ''));
    return res.json({ words });
  }
  res.json({ words: [] });
});

// API: Update word filter
app.post('/api/wordfilter', (req, res) => {
  const { words } = req.body;
  const fs = require('fs');
  const filterPath = path.join(__dirname, 'src/moderation/wordFilter.js');
  const newContent = `// Simple blocklist.\nconst blocklist = [${words.map(w => `'${w}'`).join(', ')}];\n\nfunction containsBadWord(text) {\n  if (!text) return false;\n  const lowerText = text.toLowerCase();\n  return blocklist.some(word => lowerText.includes(word));\n}\n\nmodule.exports = {\n  containsBadWord\n};`;
  fs.writeFileSync(filterPath, newContent);
  res.json({ success: true });
});
```

**Step 2: Add Word Filter tab to dashboard.html**

Add a new tab and UI for managing the word list.

**Step 3: Commit**

```bash
git add dashboard.js dashboard/dashboard.html
git commit -m "feat: add word filter manager to dashboard"
```

---

## Final Verification

1. `pm2 status` — anon-dashboard should be online
2. Open `http://localhost:3001` — login page appears
3. Login with password → dashboard loads with stats
4. Test ban/unban user
5. Test RPG players tab
6. Test reports tab

---

## Risk & Tradeoffs

| Risk | Mitigation |
|------|------------|
| Basic auth tidak secure | Password hardcode, cukup untuk internal use |
| SQLite concurrent access | better-sqlite3 sudah WAL mode, aman |
| Dashboard port exposed | Gunakan firewall atau VPN untuk akses |
| No HTTPS | Tambah nginx reverse proxy dengan SSL untuk production |
