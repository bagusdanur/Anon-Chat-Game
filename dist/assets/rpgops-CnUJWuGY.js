import{a as e,c as t,l as n,r,s as i,u as a}from"./index-DygV-4TP.js";async function o(t){t.innerHTML=`<div class="page-enter">
    <div class="card"><div class="card-header">
      <div class="card-title">${u(`activity`)} RPG Operations</div>
      <button class="btn btn-outline btn-sm" id="ops-refresh">${u(`refresh-cw`)}</button>
    </div><div class="card-body" id="ops-body">${e(6)}</div></div>
  </div>`,document.getElementById(`ops-refresh`).onclick=()=>c(),await c()}function s(){}async function c(){let e=document.getElementById(`ops-body`);try{let n=await t.get(`/api/rpg-operations`),r=Object.values(n.anomalies).reduce((e,t)=>e+t,0);e.innerHTML=`
      <div class="info-grid">
        ${l(`Total Gold`,`${Number(n.economy.totalGold).toLocaleString()}g`)}
        ${l(`Sources / Sinks`,`${n.economy.sources.toLocaleString()} / ${n.economy.sinks.toLocaleString()}`)}
        ${l(`Source-Sink Ratio`,n.economy.sourceSinkRatio??`N/A`)}
        ${l(`Market Volume`,`${Number(n.market.volume||0).toLocaleString()}g`)}
        ${l(`Active Dungeons`,n.sessions.dungeons)}
        ${l(`Pending Trades`,n.sessions.trades)}
        ${l(`Parties / Guilds`,`${n.sessions.parties} / ${n.sessions.guilds}`)}
        ${l(`Anomalies`,r)}
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
    <div class="info-cell-value">${t}</div></div>`}function u(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"></svg>`}a((()=>{n(),r()}))();export{s as cleanup,o as render};