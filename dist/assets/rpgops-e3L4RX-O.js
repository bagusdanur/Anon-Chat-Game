import{a as e,c as t,l as n,r,s as i,u as a}from"./index-B7Y9w0HT.js";async function o(t){t.innerHTML=`<div class="page-enter">
    <div class="card"><div class="card-header">
      <div class="card-title">${d(`activity`)} RPG Operations</div>
      <button class="btn btn-outline btn-sm" id="ops-refresh">${d(`refresh-cw`)}</button>
    </div><div class="card-body" id="ops-body">${e(6)}</div></div>
  </div>`,document.getElementById(`ops-refresh`).onclick=()=>c(),await c()}function s(){}async function c(){let e=document.getElementById(`ops-body`);try{let[n,r]=await Promise.all([t.get(`/api/rpg-operations`),t.get(`/api/system-health`)]),a=r.database||{},o=Object.values(n.anomalies).reduce((e,t)=>e+t,0),s=n.dungeonBalance||{},d=Number(s.totalRuns||0)>0?`${(Number(s.completed||0)/Number(s.totalRuns)*100).toFixed(1)}%`:`N/A`,f=Number(s.actions||0),p=e=>f>0?`${(Number(e||0)/f*100).toFixed(1)}%`:`N/A`;e.innerHTML=`
      <div class="info-grid">
        ${l(`Total Gold`,`${Number(n.economy.totalGold).toLocaleString()}g`)}
        ${l(`Sources / Sinks`,`${n.economy.sources.toLocaleString()} / ${n.economy.sinks.toLocaleString()}`)}
        ${l(`Source-Sink Ratio`,n.economy.sourceSinkRatio??`N/A`)}
        ${l(`Market Volume`,`${Number(n.market.volume||0).toLocaleString()}g`)}
        ${l(`Active Dungeons`,n.sessions.dungeons)}
        ${l(`Pending Trades`,n.sessions.trades)}
        ${l(`Parties / Guilds`,`${n.sessions.parties} / ${n.sessions.guilds}`)}
        ${l(`Anomalies`,o)}
        ${l(`DB Integrity`,a.integrity===`ok`?`OK`:a.integrity||`N/A`)}
        ${l(`DB Mode`,`${a.journalMode||`N/A`} · busy ${a.busyTimeoutMs||0}ms`)}
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Database & Operasional</div></div>
        <div class="card-body"><div class="info-grid">
          ${l(`Database Size`,u(a.databaseBytes))}
          ${l(`Foreign Keys`,a.foreignKeys?`ON`:`OFF`)}
          ${l(`Backup Terakhir`,a.latestBackup?new Date(a.latestBackup.mtime).toLocaleString():`Belum ada`)}
          ${l(`Ukuran Backup`,a.latestBackup?u(a.latestBackup.size):`N/A`)}
          ${l(`Dashboard Uptime`,`${Math.round(Number(r.observability?.uptimeSeconds||0)/60)}m`)}
          ${l(`Error Tracking`,r.observability?.sentryEnabled?`Sentry aktif`:`Tidak dikonfigurasi`)}
        </div><p class="muted" style="margin-top:12px">Backup dashboard membuat snapshot SQLite konsisten; bukan salinan file database yang sedang ditulis.</p></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Dungeon Balance (Anonymous)</div></div>
        <div class="card-body"><div class="info-grid">
          ${l(`Runs / Completion`,`${Number(s.totalRuns||0)} / ${d}`)}
          ${l(`Solo / Duo`,`${Number(s.soloRuns||0)} / ${Number(s.duoRuns||0)}`)}
          ${l(`Attack Rate`,p(s.attacks))}
          ${l(`Defend Rate`,p(s.defends))}
          ${l(`Skill Rate`,p(s.skills))}
          ${l(`Combo Rate`,p(s.combos))}
          ${l(`Enemy Cycles`,Number(s.enemyCycles||0))}
          ${l(`Avg. Duration`,`${Math.round(Number(s.averageDurationSeconds||0)/60)}m`)}
        </div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Item Delivery</div></div>
        <div class="card-body"><div class="info-grid">
          ${l(`Catalog Items`,Number(n.items?.catalog||0))}
          ${l(`Inventory Units`,Number(n.items?.inventoryUnits||0))}
          ${l(`Equipment Tempa`,Number(n.items?.equipmentInstances||0))}
          ${l(`Gems Delivered`,Number(n.items?.gems||0))}
          ${l(`Region Materials`,Number(n.items?.regionMaterials||0))}
        </div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Feature Flags</div></div>
        <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px">
          ${n.featureFlags.map(e=>`
            <button class="btn ${e.enabled?`btn-success`:`btn-outline`} btn-sm"
              data-flag="${e.flag_key}" data-enabled="${e.enabled}">
              ${e.flag_key}: ${e.enabled?`ON`:`OFF`}
            </button>`).join(``)}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Published Content</div></div>
        <div class="card-body">${Object.entries(n.content).map(([e,t])=>`<span class="badge badge-blue" style="margin:4px">${e}: ${t}</span>`).join(``)}</div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Schema Migrations</div></div>
        <div class="table-wrap"><table><thead><tr><th>Version</th><th>Name</th><th>Applied</th></tr></thead>
        <tbody>${n.migrations.map(e=>`<tr><td>v${e.version}</td><td>${e.name}</td>
          <td>${new Date(e.applied_at*1e3).toLocaleString()}</td></tr>`).join(``)}</tbody></table></div>
      </div>`,e.querySelectorAll(`[data-flag]`).forEach(e=>{e.onclick=async()=>{await t.post(`/api/rpg-feature-flags/${e.dataset.flag}`,{enabled:e.dataset.enabled!==`1`}),i(`Feature flag diperbarui`),await c()}}),window.lucide&&lucide.createIcons({scope:e})}catch(t){e.innerHTML=`<div style="color:var(--red)">Gagal: ${t.message}</div>`}}function l(e,t){return`<div class="info-cell"><div class="info-cell-label">${e}</div>
    <div class="info-cell-value">${t}</div></div>`}function u(e){let t=Number(e||0);return t<1024?`${t} B`:t<1024*1024?`${(t/1024).toFixed(1)} KB`:`${(t/(1024*1024)).toFixed(1)} MB`}function d(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"></svg>`}a((()=>{n(),r()}))();export{s as cleanup,o as render};