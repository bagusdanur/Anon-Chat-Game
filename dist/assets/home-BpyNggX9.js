import{c as e,l as t,o as n,r,u as i}from"./index-DR3-DQ5l.js";async function a(e){e.innerHTML=`
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
          <div class="skeleton" style="height:38px;width:150px"></div>
        </div>
      </div>
    </div>`,await c(e),s(e)}function o(){u&&=(clearInterval(u),null)}function s(e){u&&clearInterval(u),u=setInterval(()=>c(e),3e4)}async function c(t){try{let n=await e.get(`/api/stats`);t.innerHTML=`<div class="page-enter">${`
      <div class="stats-grid">
        ${[{label:`Total Users`,val:n.totalUsers,color:`--blue`,icon:`users`,sub:`terdaftar`},{label:`Online`,val:n.onlineUsers,color:`--green`,icon:`wifi`,sub:`aktif sekarang`},{label:`Paired`,val:n.pairedUsers,color:`--yellow`,icon:`heart`,sub:`sedang chat`},{label:`Queue`,val:n.queuedUsers,color:`--cyan`,icon:`clock`,sub:`menunggu`},{label:`Banned`,val:n.bannedUsers,color:`--red`,icon:`ban`,sub:`diblokir`},{label:`Reports`,val:n.totalReports,color:`--pink`,icon:`flag`,sub:`total laporan`},{label:`RPG Players`,val:n.rpgUsers,color:`--accent`,icon:`swords`,sub:`bermain RPG`},{label:`Dungeon Runs`,val:n.totalDungeonRuns,color:`--orange`,icon:`castle`,sub:`total runs`}].map(e=>`
          <div class="stat-card">
            <div class="stat-accent-bar" style="background:var(${e.color})"></div>
            <div class="stat-top">
              <div class="stat-label">${e.label}</div>
              <div class="stat-icon" style="background:var(${e.color});color:#000">
                ${l(e.icon)}
              </div>
            </div>
            <div class="stat-value">${e.val.toLocaleString()}</div>
            <div class="stat-sub">${e.sub}</div>
          </div>
        `).join(``)}
      </div>`}${`
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            ${l(`zap`)} Quick Actions
          </div>
          <span style="font-size:11px;color:var(--muted)">Auto-refresh: 30s</span>
        </div>
        <div class="card-body" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button class="btn btn-yellow" onclick="window.appNav('reports')">
            ${l(`flag`)} Lihat Reports (${n.reports24h} hari ini)
          </button>
          <button class="btn btn-primary" onclick="window.appNav('users')">
            ${l(`users`)} Kelola Users
          </button>
          <button class="btn btn-outline" onclick="window.triggerBroadcast()">
            ${l(`megaphone`)} Broadcast
          </button>
          <button class="btn btn-outline" onclick="window.appNav('maintenance')">
            ${l(`wrench`)} Maintenance
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">${l(`activity`)} Bot Statistics</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border-dark);border:2px solid var(--border-dark)">
          ${[[`Total Duels`,n.totalDuels],[`Total Transactions`,n.totalTransactions],[`Reports 24h`,n.reports24h]].map(([e,t])=>`
            <div style="background:var(--surface);padding:16px">
              <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">${e}</div>
              <div style="font-size:22px;font-weight:700">${t.toLocaleString()}</div>
            </div>
          `).join(``)}
        </div>
      </div>`}</div>`,window.lucide&&lucide.createIcons({scope:t})}catch(e){t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Gagal memuat stats: ${e.message}</p></div></div>`}}function l(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}var u;i((()=>{t(),r(),u=null}))();export{o as cleanup,a as render};