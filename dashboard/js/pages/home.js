/**
 * home.js — Dashboard overview page
 */
import API from '../api.js';
import { skeletonStats } from '../components.js';

let _refreshTimer = null;
let _chartObj = null;

export async function render(container) {
  // Show skeletons first
  container.innerHTML = `
    <div class="page-enter">
      ${skeletonStats(8)}
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            Quick Actions
          </div>
        </div>
        <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap">
          <div class="skeleton" style="height:38px;width:160px"></div>
          <div class="skeleton" style="height:38px;width:130px"></div>
        </div>
      </div>
    </div>`;

  await loadStats(container);
  startAutoRefresh(container);
}

export function cleanup() {
  if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
  if (_chartObj) { _chartObj.destroy(); _chartObj = null; }
}

function startAutoRefresh(container) {
  if (_refreshTimer) clearInterval(_refreshTimer);
  _refreshTimer = setInterval(() => loadStats(container, false), 30000);
}

async function loadStats(container, fullRender = true) {
  try {
    const [S, chartData] = await Promise.all([
      API.get('/api/stats'),
      API.get('/api/stats/chart')
    ]);

    const cards = [
      { label: 'Total Users',    val: S.totalUsers,       color: '--blue',   icon: 'users',         sub: 'terdaftar' },
      { label: 'Online',         val: S.onlineUsers,      color: '--green',  icon: 'wifi',          sub: 'aktif sekarang' },
      { label: 'Paired',         val: S.pairedUsers,      color: '--yellow', icon: 'heart',         sub: 'sedang chat' },
      { label: 'Queue',          val: S.queuedUsers,      color: '--cyan',   icon: 'clock',         sub: 'menunggu' },
      { label: 'Banned',         val: S.bannedUsers,      color: '--red',    icon: 'ban',           sub: 'diblokir' },
      { label: 'Reports',        val: S.totalReports,     color: '--pink',   icon: 'flag',          sub: 'total laporan' },
      { label: 'RPG Players',    val: S.rpgUsers,         color: '--accent', icon: 'swords',        sub: 'bermain RPG' },
      { label: 'Dungeon Runs',   val: S.totalDungeonRuns, color: '--orange', icon: 'castle',        sub: 'total runs' },
    ];

    const statsHTML = `
      <div class="stats-grid">
        ${cards.map(c => `
          <div class="stat-card">
            <div class="stat-accent-bar" style="background:var(${c.color})"></div>
            <div class="stat-top">
              <div class="stat-label">${c.label}</div>
              <div class="stat-icon" style="background:var(${c.color});color:#000">
                ${lucideIcon(c.icon)}
              </div>
            </div>
            <div class="stat-value">${c.val.toLocaleString()}</div>
            <div class="stat-sub">${c.sub}</div>
          </div>
        `).join('')}
      </div>`;

    const chartHTML = `
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <div class="card-title">${lucideIcon('trending-up')} Trend 7 Hari Terakhir</div>
        </div>
        <div class="card-body">
          <canvas id="trendChart" height="80"></canvas>
        </div>
      </div>
    `;

    const quickHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${lucideIcon('zap')} Quick Actions
          </div>
          <span style="font-size:11px;color:var(--muted)">Auto-refresh: 30s</span>
        </div>
        <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-yellow" onclick="window.appNav('reports')">
            ${lucideIcon('flag')} Lihat Reports (${S.reports24h} hari ini)
          </button>
          <button class="btn btn-primary" onclick="window.appNav('users')">
            ${lucideIcon('users')} Kelola Users
          </button>
          <button class="btn btn-outline" onclick="window.triggerBroadcast()">
            ${lucideIcon('megaphone')} Broadcast
          </button>
          <button class="btn btn-outline" onclick="window.appNav('settings')">
            ${lucideIcon('settings')} Game Settings
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">${lucideIcon('activity')} Bot Statistics</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border-dark);border:2px solid var(--border-dark)">
          ${[
            ['Total Duels',        S.totalDuels],
            ['Total Transactions', S.totalTransactions],
            ['Reports 24h',        S.reports24h],
          ].map(([label, val]) => `
            <div style="background:var(--surface);padding:16px">
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">${label}</div>
              <div style="font-size:22px;font-weight:700">${val.toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
      </div>`;

    if (fullRender) {
      container.innerHTML = `<div class="page-enter">${statsHTML}${chartHTML}${quickHTML}</div>`;
      if (window.lucide) lucide.createIcons({ scope: container });
      renderChart(chartData);
    } else {
      // Just update the numbers if we don't want to break the chart instance
      // (Simplified for this project: re-render everything since it's fast anyway)
      container.innerHTML = `<div class="page-enter">${statsHTML}${chartHTML}${quickHTML}</div>`;
      if (window.lucide) lucide.createIcons({ scope: container });
      renderChart(chartData);
    }
  } catch (e) {
    if (fullRender) {
      container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--red)">Gagal memuat stats: ${e.message}</p></div></div>`;
    }
  }
}

function renderChart(data) {
  const ctx = document.getElementById('trendChart');
  if (!ctx || !window.Chart) return;
  if (_chartObj) _chartObj.destroy();

  // Combine dates from both datasets
  const dates = [...new Set([
    ...data.users.map(d => d.date),
    ...data.transactions.map(d => d.date)
  ])].sort();

  const userCounts = dates.map(d => {
    const f = data.users.find(x => x.date === d);
    return f ? f.count : 0;
  });

  const txTotals = dates.map(d => {
    const f = data.transactions.find(x => x.date === d);
    return f ? (f.total || 0) : 0;
  });

  Chart.defaults.color = '#a0a0b0';
  Chart.defaults.font.family = '"Space Grotesk", sans-serif';

  _chartObj = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates,
      datasets: [
        {
          label: 'User Baru',
          data: userCounts,
          borderColor: '#4ade80',
          backgroundColor: 'rgba(74, 222, 128, 0.2)',
          borderWidth: 3,
          tension: 0.3,
          fill: true
        },
        {
          label: 'Volume Transaksi Gold',
          data: txTotals,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.2)',
          borderWidth: 3,
          tension: 0.3,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { labels: { font: { weight: 'bold' } } }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function lucideIcon(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${name}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`;
}
