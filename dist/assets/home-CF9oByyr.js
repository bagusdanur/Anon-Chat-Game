import{c as e,l as t,o as n,r,u as i}from"./index-DygV-4TP.js";async function a(e){e.innerHTML=`
    <div class="page-enter">
      ${n(8)}
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
    </div>`,await c(e),s(e)}function o(){d&&=(clearInterval(d),null),f&&=(f.destroy(),null)}function s(e){d&&clearInterval(d),d=setInterval(()=>c(e,!1),3e4)}async function c(t,n=!0){try{let[n,r]=await Promise.all([e.get(`/api/stats`),e.get(`/api/stats/chart`)]);t.innerHTML=`<div class="page-enter">${`
      <div class="stats-grid">
        ${[{label:`Total Users`,val:n.totalUsers,color:`--blue`,icon:`users`,sub:`terdaftar`},{label:`Online`,val:n.onlineUsers,color:`--green`,icon:`wifi`,sub:`aktif sekarang`},{label:`Paired`,val:n.pairedUsers,color:`--yellow`,icon:`heart`,sub:`sedang chat`},{label:`Queue`,val:n.queuedUsers,color:`--cyan`,icon:`clock`,sub:`menunggu`},{label:`Banned`,val:n.bannedUsers,color:`--red`,icon:`ban`,sub:`diblokir`},{label:`Reports`,val:n.totalReports,color:`--pink`,icon:`flag`,sub:`total laporan`},{label:`RPG Players`,val:n.rpgUsers,color:`--accent`,icon:`swords`,sub:`bermain RPG`},{label:`Dungeon Runs`,val:n.totalDungeonRuns,color:`--orange`,icon:`castle`,sub:`total runs`}].map(e=>`
          <div class="stat-card">
            <div class="stat-accent-bar" style="background:var(${e.color})"></div>
            <div class="stat-top">
              <div class="stat-label">${e.label}</div>
              <div class="stat-icon" style="background:var(${e.color});color:#000">
                ${u(e.icon)}
              </div>
            </div>
            <div class="stat-value">${e.val.toLocaleString()}</div>
            <div class="stat-sub">${e.sub}</div>
          </div>
        `).join(``)}
      </div>`}${`
      <div class="card" style="margin-top:20px">
        <div class="card-header">
          <div class="card-title">${u(`trending-up`)} Trend 7 Hari Terakhir</div>
        </div>
        <div class="card-body">
          <canvas id="trendChart" height="80"></canvas>
        </div>
      </div>
    `}${`
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${u(`zap`)} Quick Actions
          </div>
          <span style="font-size:11px;color:var(--muted)">Auto-refresh: 30s</span>
        </div>
        <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-yellow" onclick="window.appNav('reports')">
            ${u(`flag`)} Lihat Reports (${n.reports24h} hari ini)
          </button>
          <button class="btn btn-primary" onclick="window.appNav('users')">
            ${u(`users`)} Kelola Users
          </button>
          <button class="btn btn-outline" onclick="window.triggerBroadcast()">
            ${u(`megaphone`)} Broadcast
          </button>
          <button class="btn btn-outline" onclick="window.appNav('settings')">
            ${u(`settings`)} Game Settings
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">${u(`activity`)} Bot Statistics</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border-dark);border:2px solid var(--border-dark)">
          ${[[`Total Duels`,n.totalDuels],[`Total Transactions`,n.totalTransactions],[`Reports 24h`,n.reports24h]].map(([e,t])=>`
            <div style="background:var(--surface);padding:16px">
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">${e}</div>
              <div style="font-size:22px;font-weight:700">${t.toLocaleString()}</div>
            </div>
          `).join(``)}
        </div>
      </div>`}</div>`,window.lucide&&lucide.createIcons({scope:t}),l(r)}catch(e){n&&(t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Gagal memuat stats: ${e.message}</p></div></div>`)}}function l(e){let t=document.getElementById(`trendChart`);if(!t||!window.Chart)return;f&&f.destroy();let n=[...new Set([...e.users.map(e=>e.date),...e.transactions.map(e=>e.date)])].sort(),r=n.map(t=>{let n=e.users.find(e=>e.date===t);return n?n.count:0}),i=n.map(t=>{let n=e.transactions.find(e=>e.date===t);return n&&n.total||0});Chart.defaults.color=`#a0a0b0`,Chart.defaults.font.family=`"Space Grotesk", sans-serif`,f=new Chart(t,{type:`line`,data:{labels:n,datasets:[{label:`User Baru`,data:r,borderColor:`#4ade80`,backgroundColor:`rgba(74, 222, 128, 0.2)`,borderWidth:3,tension:.3,fill:!0},{label:`Volume Transaksi Gold`,data:i,borderColor:`#60a5fa`,backgroundColor:`rgba(96, 165, 250, 0.2)`,borderWidth:3,tension:.3,fill:!0}]},options:{responsive:!0,plugins:{legend:{labels:{font:{weight:`bold`}}}},scales:{y:{beginAtZero:!0,grid:{color:`rgba(255,255,255,0.05)`}},x:{grid:{color:`rgba(255,255,255,0.05)`}}}}})}function u(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}var d,f;i((()=>{t(),r(),d=null,f=null}))();export{o as cleanup,a as render};