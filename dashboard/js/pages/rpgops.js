import API from '../api.js';
import { toast, skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter">
    <div class="card"><div class="card-header">
      <div class="card-title">${ic('activity')} RPG Operations</div>
      <button class="btn btn-outline btn-sm" id="ops-refresh">${ic('refresh-cw')}</button>
    </div><div class="card-body" id="ops-body">${skeletonRows(6)}</div></div>
  </div>`;
  document.getElementById('ops-refresh').onclick = () => load();
  await load();
}

export function cleanup() {}

async function load() {
  const body = document.getElementById('ops-body');
  try {
    const d = await API.get('/api/rpg-operations');
    const anomalies = Object.values(d.anomalies).reduce((sum, value) => sum + value, 0);
    const dungeon = d.dungeonBalance || {};
    const completionRate = Number(dungeon.totalRuns || 0) > 0
      ? `${(Number(dungeon.completed || 0) / Number(dungeon.totalRuns) * 100).toFixed(1)}%`
      : 'N/A';
    const actionTotal = Number(dungeon.actions || 0);
    const actionRate = value => actionTotal > 0
      ? `${(Number(value || 0) / actionTotal * 100).toFixed(1)}%`
      : 'N/A';
    body.innerHTML = `
      <div class="info-grid">
        ${cell('Total Gold', `${Number(d.economy.totalGold).toLocaleString()}g`)}
        ${cell('Sources / Sinks', `${d.economy.sources.toLocaleString()} / ${d.economy.sinks.toLocaleString()}`)}
        ${cell('Source-Sink Ratio', d.economy.sourceSinkRatio ?? 'N/A')}
        ${cell('Market Volume', `${Number(d.market.volume || 0).toLocaleString()}g`)}
        ${cell('Active Dungeons', d.sessions.dungeons)}
        ${cell('Pending Trades', d.sessions.trades)}
        ${cell('Parties / Guilds', `${d.sessions.parties} / ${d.sessions.guilds}`)}
        ${cell('Anomalies', anomalies)}
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Dungeon Balance (Anonymous)</div></div>
        <div class="card-body"><div class="info-grid">
          ${cell('Runs / Completion', `${Number(dungeon.totalRuns || 0)} / ${completionRate}`)}
          ${cell('Solo / Duo', `${Number(dungeon.soloRuns || 0)} / ${Number(dungeon.duoRuns || 0)}`)}
          ${cell('Attack Rate', actionRate(dungeon.attacks))}
          ${cell('Defend Rate', actionRate(dungeon.defends))}
          ${cell('Skill Rate', actionRate(dungeon.skills))}
          ${cell('Combo Rate', actionRate(dungeon.combos))}
          ${cell('Enemy Cycles', Number(dungeon.enemyCycles || 0))}
          ${cell('Avg. Duration', `${Math.round(Number(dungeon.averageDurationSeconds || 0) / 60)}m`)}
        </div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Item Delivery</div></div>
        <div class="card-body"><div class="info-grid">
          ${cell('Catalog Items', Number(d.items?.catalog || 0))}
          ${cell('Inventory Units', Number(d.items?.inventoryUnits || 0))}
          ${cell('Equipment V2', Number(d.items?.equipmentInstances || 0))}
          ${cell('Gems Delivered', Number(d.items?.gems || 0))}
          ${cell('Region Materials', Number(d.items?.regionMaterials || 0))}
        </div></div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Feature Flags</div></div>
        <div class="card-body" style="display:flex;flex-wrap:wrap;gap:8px">
          ${d.featureFlags.map(flag => `
            <button class="btn ${flag.enabled ? 'btn-success' : 'btn-outline'} btn-sm"
              data-flag="${flag.flag_key}" data-enabled="${flag.enabled}">
              ${flag.flag_key}: ${flag.enabled ? 'ON' : 'OFF'}
            </button>`).join('')}
        </div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Published Content</div></div>
        <div class="card-body">${Object.entries(d.content).map(([key,value]) =>
          `<span class="badge badge-blue" style="margin:4px">${key}: ${value}</span>`).join('')}</div>
      </div>
      <div class="card" style="margin-top:16px">
        <div class="card-header"><div class="card-title">Schema Migrations</div></div>
        <div class="table-wrap"><table><thead><tr><th>Version</th><th>Name</th><th>Applied</th></tr></thead>
        <tbody>${d.migrations.map(row => `<tr><td>v${row.version}</td><td>${row.name}</td>
          <td>${new Date(row.applied_at * 1000).toLocaleString()}</td></tr>`).join('')}</tbody></table></div>
      </div>`;
    body.querySelectorAll('[data-flag]').forEach(button => {
      button.onclick = async () => {
        await API.post(`/api/rpg-feature-flags/${button.dataset.flag}`, {
          enabled: button.dataset.enabled !== '1',
        });
        toast('Feature flag diperbarui');
        await load();
      };
    });
    if (window.lucide) lucide.createIcons({ scope: body });
  } catch (error) {
    body.innerHTML = `<div style="color:var(--red)">Gagal: ${error.message}</div>`;
  }
}

function cell(label, value) {
  return `<div class="info-cell"><div class="info-cell-label">${label}</div>
    <div class="info-cell-value">${value}</div></div>`;
}

function ic(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${name}" width="14" height="14"
    viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"></svg>`;
}
