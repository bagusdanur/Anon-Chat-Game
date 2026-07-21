import{c as e,l as t,u as n}from"./index-B39UAyRg.js";async function r(t){t.innerHTML=`<div class="page-enter"><div class="skeleton" style="height:300px"></div></div>`;try{let n=await e.get(`/api/settings`);t.innerHTML=`
      <div class="page-enter">
        <div class="card">
          <div class="card-header">
            <div class="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Dynamic Game Settings
            </div>
            <span style="font-size:12px;color:var(--muted)">Live config without restarting bot</span>
          </div>
          <div class="card-body">
            <form id="settingsForm" style="display:flex;flex-direction:column;gap:15px;max-width:500px">
              
              <div class="form-group">
                <label class="form-label">EXP Multiplier (x)</label>
                <input type="number" id="exp_multiplier" step="0.1" class="form-control" value="${n.exp_multiplier}" required>
                <div style="font-size:12px;color:var(--muted);margin-top:6px">Contoh: 2.0 untuk Double EXP event.</div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Gold Multiplier (x)</label>
                <input type="number" id="gold_multiplier" step="0.1" class="form-control" value="${n.gold_multiplier}" required>
                <div style="font-size:12px;color:var(--muted);margin-top:6px">Mempengaruhi reward /hunt, /mine, /dungeon.</div>
              </div>
              
              <div class="form-group">
                <label class="form-label">Drop Rate Multiplier (x)</label>
                <input type="number" id="drop_rate_multiplier" step="0.1" class="form-control" value="${n.drop_rate_multiplier}" required>
                <div style="font-size:12px;color:var(--muted);margin-top:6px">Meningkatkan peluang item langka. 1.0 = Normal.</div>
              </div>

              <div class="form-group">
                <label class="form-label">Grind Cooldown (Minutes)</label>
                <input type="number" id="grind_cooldown_minutes" class="form-control" value="${n.grind_cooldown_minutes}" required>
                <div style="font-size:12px;color:var(--muted);margin-top:6px">Waktu cooldown untuk regenerasi energi atau limit hunt.</div>
              </div>

              <div style="border-top:1px solid var(--border); padding-top:15px; margin-top:10px;">
                <h4 style="margin:0 0 15px 0">🎁 Daily Reward (/daily)</h4>
                <div style="display:flex; gap:10px;">
                  <div class="form-group" style="flex:1">
                    <label class="form-label">Gold</label>
                    <input type="number" id="daily_gold" class="form-control" value="${n.daily_reward?.gold||80}" required>
                  </div>
                  <div class="form-group" style="flex:1">
                    <label class="form-label">EXP</label>
                    <input type="number" id="daily_xp" class="form-control" value="${n.daily_reward?.xp||25}" required>
                  </div>
                  <div class="form-group" style="flex:1.5">
                    <label class="form-label">Item Drop</label>
                    <input type="text" id="daily_item" class="form-control" value="${n.daily_reward?.item||``}" placeholder="e.g. ramuan_kecil">
                  </div>
                </div>
              </div>

              <div style="border-top:1px solid var(--border); padding-top:15px; margin-top:10px;">
                <h4 style="margin:0 0 15px 0">⚒️ Upgrade System (/upgrade)</h4>
                <div style="display:flex; gap:10px;">
                  <div class="form-group" style="flex:1">
                    <label class="form-label">Base Gold Cost</label>
                    <input type="number" id="upg_gold" class="form-control" value="${n.upgrade_settings?.base_gold_cost||100}" required>
                  </div>
                  <div class="form-group" style="flex:1">
                    <label class="form-label">Base Ore Cost</label>
                    <input type="number" id="upg_ore" class="form-control" value="${n.upgrade_settings?.base_ore_cost||3}" required>
                  </div>
                </div>
                <div class="form-group" style="margin-top:10px">
                  <label class="form-label">Allowed Ores (Comma separated IDs)</label>
                  <input type="text" id="upg_ores" class="form-control" value="${(n.upgrade_settings?.allowed_ores||[]).join(`,`)}" required>
                  <div style="font-size:12px;color:var(--muted);margin-top:6px">ID item material yang bisa dipakai untuk upgrade. Pisahkan dengan koma.</div>
                </div>
              </div>

              <div style="margin-top:10px">
                <button type="submit" class="btn btn-primary">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `,document.getElementById(`settingsForm`).addEventListener(`submit`,async t=>{t.preventDefault();let n=t.target.querySelector(`button`);n.disabled=!0,n.innerHTML=`Saving...`;let r={exp_multiplier:parseFloat(document.getElementById(`exp_multiplier`).value),gold_multiplier:parseFloat(document.getElementById(`gold_multiplier`).value),drop_rate_multiplier:parseFloat(document.getElementById(`drop_rate_multiplier`).value),grind_cooldown_minutes:parseInt(document.getElementById(`grind_cooldown_minutes`).value),daily_reward:{gold:parseInt(document.getElementById(`daily_gold`).value),xp:parseInt(document.getElementById(`daily_xp`).value),item:document.getElementById(`daily_item`).value.trim()||null},upgrade_settings:{base_gold_cost:parseInt(document.getElementById(`upg_gold`).value),base_ore_cost:parseInt(document.getElementById(`upg_ore`).value),allowed_ores:document.getElementById(`upg_ores`).value.split(`,`).map(e=>e.trim()).filter(Boolean)}};try{await e.post(`/api/settings`,r),window.showToast(`Game Settings updated successfully!`,`success`)}catch(e){window.showToast(e.message,`error`)}finally{n.disabled=!1,n.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Settings`}})}catch(e){t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load settings: ${e.message}</p></div></div>`}}n((()=>{t()}))();export{r as render};