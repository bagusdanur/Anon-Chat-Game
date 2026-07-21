/**
 * gamedata.js — Master RPG Game Data Configuration
 */
import API from '../api.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="skeleton" style="height:400px"></div></div>`;
  
  try {
    const [bosses, monsters, shops, crafting, quests] = await Promise.all([
      API.get('/api/bosses'),
      API.get('/api/monsters'),
      API.get('/api/shops'),
      API.get('/api/crafting'),
      API.get('/api/quests')
    ]);
    
    const configs = {
      bosses: { title: 'Bosses', data: bosses, endpoint: '/api/bosses' },
      monsters: { title: 'Monsters', data: monsters, endpoint: '/api/monsters' },
      shops: { title: 'Shops', data: shops, endpoint: '/api/shops' },
      crafting: { title: 'Crafting', data: crafting, endpoint: '/api/crafting' },
      quests: { title: 'Quests', data: quests, endpoint: '/api/quests' }
    };

    let activeTab = 'bosses';

    const renderTabs = () => {
      let tabsHtml = '<div class="tabs" style="display:flex;gap:10px;margin-bottom:15px;border-bottom:2px solid var(--border);padding-bottom:10px">';
      for (const key of Object.keys(configs)) {
        const isActive = key === activeTab;
        tabsHtml += `<button class="btn btn-${isActive ? 'primary' : 'secondary'} tab-btn" data-tab="${key}">${configs[key].title}</button>`;
      }
      tabsHtml += '</div>';
      return tabsHtml;
    };

    const renderEditor = () => {
      const config = configs[activeTab];
      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">Edit ${config.title} Config (JSON)</div>
            <span style="font-size:12px;color:var(--muted)">Hati-hati, format JSON harus valid!</span>
          </div>
          <div class="card-body">
            <textarea id="jsonEditor" class="form-control" style="font-family:monospace;min-height:400px;font-size:13px;background:var(--bg-card);color:var(--text);border:2px solid var(--border)">${JSON.stringify(config.data, null, 2)}</textarea>
            <div style="margin-top:15px;display:flex;gap:10px;">
              <button id="saveBtn" class="btn btn-primary">Save ${config.title}</button>
              <button id="formatBtn" class="btn btn-secondary">Format JSON</button>
            </div>
            <div id="errorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
          </div>
        </div>
      `;
    };

    const mountUI = () => {
      container.innerHTML = `
        <div class="page-enter">
          <div style="margin-bottom:20px;">
            <h2>Master Game Data</h2>
            <p style="color:var(--muted)">Edit konfigurasi seluruh data RPG seperti monster, item shop, dan boss raid secara real-time.</p>
          </div>
          ${renderTabs()}
          <div id="editorContainer">
            ${renderEditor()}
          </div>
        </div>
      `;

      // Bind Tab Events
      container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          activeTab = e.target.dataset.tab;
          mountUI();
        });
      });

      // Bind Save Event
      document.getElementById('saveBtn').addEventListener('click', async (e) => {
        const btn = e.target;
        const errDiv = document.getElementById('errorMsg');
        const editor = document.getElementById('jsonEditor');
        errDiv.style.display = 'none';
        
        let parsedData;
        try {
          parsedData = JSON.parse(editor.value);
        } catch(err) {
          errDiv.textContent = 'Invalid JSON: ' + err.message;
          errDiv.style.display = 'block';
          return;
        }

        btn.disabled = true;
        btn.textContent = 'Saving...';
        
        try {
          await API.post(configs[activeTab].endpoint, parsedData);
          configs[activeTab].data = parsedData; // update local state
          window.showToast(`${configs[activeTab].title} config saved!`, 'success');
        } catch(err) {
          window.showToast('Failed to save: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = `Save ${configs[activeTab].title}`;
        }
      });

      // Bind Format Event
      document.getElementById('formatBtn').addEventListener('click', () => {
        const editor = document.getElementById('jsonEditor');
        const errDiv = document.getElementById('errorMsg');
        errDiv.style.display = 'none';
        try {
          const parsedData = JSON.parse(editor.value);
          editor.value = JSON.stringify(parsedData, null, 2);
        } catch(err) {
          errDiv.textContent = 'Cannot format invalid JSON: ' + err.message;
          errDiv.style.display = 'block';
        }
      });
    };

    mountUI();

  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load game data: ${err.message}</p></div></div>`;
  }
}
