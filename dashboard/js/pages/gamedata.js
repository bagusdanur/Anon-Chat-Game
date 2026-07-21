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
    let editMode = 'form'; // 'form' or 'json'

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
      
      let headerHtml = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
          <h3 style="margin:0">Edit ${config.title}</h3>
          <div class="tabs" style="display:flex;gap:5px;">
            <button class="btn btn-${editMode === 'form' ? 'primary' : 'outline'} mode-btn" data-mode="form"><i data-lucide="list"></i> Form Mode</button>
            <button class="btn btn-${editMode === 'json' ? 'primary' : 'outline'} mode-btn" data-mode="json"><i data-lucide="code"></i> JSON Mode</button>
          </div>
        </div>
      `;

      if (editMode === 'json') {
        return headerHtml + `
          <div class="card">
            <div class="card-header">
              <span style="font-size:12px;color:var(--muted)">Hati-hati, format JSON harus valid!</span>
            </div>
            <div class="card-body">
              <textarea id="jsonEditor" class="form-control" style="font-family:monospace;min-height:400px;font-size:13px;background:var(--bg-card);color:var(--text);border:2px solid var(--border)">${JSON.stringify(config.data, null, 2)}</textarea>
              <div style="margin-top:15px;display:flex;gap:10px;">
                <button id="saveJsonBtn" class="btn btn-primary">Save ${config.title}</button>
                <button id="formatBtn" class="btn btn-secondary">Format JSON</button>
              </div>
              <div id="errorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
            </div>
          </div>
        `;
      } else {
        // FORM MODE
        const keys = Object.keys(config.data);
        if (keys.length !== 1 || !Array.isArray(config.data[keys[0]])) {
          return headerHtml + `<div class="card"><div class="card-body">Struktur data ini kompleks. Silakan gunakan <b>JSON Mode</b>.</div></div>`;
        }
        
        const mainKey = keys[0];
        const arrayData = config.data[mainKey] || [];
        
        let formHtml = `<div class="card" style="background:transparent;border:none"><div class="card-body" style="padding:0"><div id="formEditorContainer" style="display:flex;flex-direction:column;gap:15px;">`;
        
        arrayData.forEach((item, index) => {
          formHtml += `<div class="card" style="border:2px solid var(--border); box-shadow:none">
            <div class="card-header" style="display:flex;justify-content:space-between;padding:10px 15px;">
              <strong>Item #${index + 1}</strong>
              <button class="btn btn-danger btn-sm remove-item-btn" data-index="${index}"><i data-lucide="trash-2"></i></button>
            </div>
            <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;
            
          for (const [k, v] of Object.entries(item)) {
            const valType = typeof v;
            if (v !== null && valType === 'object') {
              formHtml += `<div class="form-group" style="grid-column: span 2">
                <label class="form-label">${k} <span style="color:var(--muted);font-weight:normal">(JSON Object/Array)</span></label>
                <textarea class="form-control form-field-input" data-index="${index}" data-key="${k}" data-type="object" style="font-family:monospace" rows="3">${JSON.stringify(v)}</textarea>
              </div>`;
            } else if (valType === 'boolean') {
               formHtml += `<div class="form-group">
                <label class="form-label">${k}</label>
                <select class="form-control form-field-input" data-index="${index}" data-key="${k}" data-type="boolean">
                  <option value="true" ${v === true ? 'selected' : ''}>True</option>
                  <option value="false" ${v === false ? 'selected' : ''}>False</option>
                </select>
              </div>`;
            } else {
              formHtml += `<div class="form-group">
                <label class="form-label">${k}</label>
                <input type="${valType === 'number' ? 'number' : 'text'}" class="form-control form-field-input" data-index="${index}" data-key="${k}" data-type="${valType}" value="${v !== null ? v : ''}">
              </div>`;
            }
          }
          formHtml += `</div></div>`;
        });
        
        formHtml += `</div>
          <div style="margin-top:15px;display:flex;gap:10px;">
            <button id="addFormBtn" class="btn btn-outline"><i data-lucide="plus"></i> Tambah Item Baru</button>
            <button id="saveFormBtn" class="btn btn-primary"><i data-lucide="save"></i> Save ${config.title}</button>
          </div>
          <div id="formErrorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
        </div></div>`;
        
        return headerHtml + formHtml;
      }
    };

    const mountUI = () => {
      container.innerHTML = `
        <div class="page-enter">
          <div style="margin-bottom:20px;">
            <h2>Master Game Data</h2>
            <p style="color:var(--muted)">Edit konfigurasi seluruh data RPG secara real-time melalui Form Mode atau JSON Mode.</p>
          </div>
          ${renderTabs()}
          <div id="editorContainer">
            ${renderEditor()}
          </div>
        </div>
      `;
      
      if (window.lucide) window.lucide.createIcons();

      // Bind Tab Events
      container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          activeTab = e.target.dataset.tab;
          mountUI();
        });
      });

      // Bind Mode Toggle Events
      container.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          editMode = e.currentTarget.dataset.mode;
          mountUI();
        });
      });

      // JSON MODE BINDINGS
      if (editMode === 'json') {
        const saveJsonBtn = document.getElementById('saveJsonBtn');
        if (saveJsonBtn) {
          saveJsonBtn.addEventListener('click', async (e) => {
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
              configs[activeTab].data = parsedData;
              window.showToast(`${configs[activeTab].title} saved!`, 'success');
            } catch(err) {
              window.showToast('Failed to save: ' + err.message, 'error');
            } finally {
              btn.disabled = false;
              btn.textContent = `Save ${configs[activeTab].title}`;
            }
          });
        }

        const formatBtn = document.getElementById('formatBtn');
        if (formatBtn) {
          formatBtn.addEventListener('click', () => {
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
        }
      } 
      // FORM MODE BINDINGS
      else {
        const mainKey = Object.keys(configs[activeTab].data)[0];
        const arrayData = configs[activeTab].data[mainKey];

        const saveFormBtn = document.getElementById('saveFormBtn');
        if (saveFormBtn) {
          saveFormBtn.addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const errDiv = document.getElementById('formErrorMsg');
            errDiv.style.display = 'none';
            
            // Reconstruct arrayData from DOM
            const newArray = [];
            const inputs = document.querySelectorAll('.form-field-input');
            let hasError = false;

            inputs.forEach(input => {
              const idx = parseInt(input.dataset.index);
              const key = input.dataset.key;
              const type = input.dataset.type;
              
              if (!newArray[idx]) newArray[idx] = {};
              
              let val = input.value;
              
              if (type === 'number') {
                val = val === '' ? null : Number(val);
              } else if (type === 'boolean') {
                val = val === 'true';
              } else if (type === 'object') {
                if (val.trim() === '') {
                   val = null;
                } else {
                  try {
                    val = JSON.parse(val);
                  } catch(err) {
                    hasError = true;
                    errDiv.textContent = "Invalid JSON in Item #" + (idx + 1) + ", field '" + key + "': " + err.message;
                    errDiv.style.display = 'block';
                  }
                }
              }
              
              newArray[idx][key] = val;
            });

            if (hasError) return;

            const payload = { ...configs[activeTab].data, [mainKey]: newArray };

            btn.disabled = true;
            btn.innerHTML = 'Saving...';
            
            try {
              await API.post(configs[activeTab].endpoint, payload);
              configs[activeTab].data = payload;
              window.showToast(`${configs[activeTab].title} saved via Form!`, 'success');
              mountUI(); // re-render to reflect clean state
            } catch(err) {
              window.showToast('Failed to save: ' + err.message, 'error');
            } finally {
              btn.disabled = false;
              btn.innerHTML = `<i data-lucide="save"></i> Save ${configs[activeTab].title}`;
              if (window.lucide) window.lucide.createIcons();
            }
          });
        }

        const addBtn = document.getElementById('addFormBtn');
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            // Reconstruct current DOM state before appending so we don't lose unsaved typing
            const inputs = document.querySelectorAll('.form-field-input');
            inputs.forEach(input => {
              const idx = parseInt(input.dataset.index);
              const key = input.dataset.key;
              let val = input.value;
              if (input.dataset.type === 'object') {
                try { val = JSON.parse(val); } catch(e) {}
              } else if (input.dataset.type === 'number') {
                 val = Number(val);
              } else if (input.dataset.type === 'boolean') {
                 val = val === 'true';
              }
              if (arrayData[idx]) arrayData[idx][key] = val;
            });

            // Create new template item based on the first item keys
            let template = {};
            if (arrayData.length > 0) {
              Object.keys(arrayData[0]).forEach(k => {
                const type = typeof arrayData[0][k];
                if (type === 'number') template[k] = 0;
                else if (type === 'boolean') template[k] = false;
                else if (Array.isArray(arrayData[0][k])) template[k] = [];
                else if (type === 'object' && arrayData[0][k] !== null) template[k] = {};
                else template[k] = '';
              });
            }
            arrayData.push(template);
            mountUI();
          });
        }

        container.querySelectorAll('.remove-item-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            if (!confirm('Hapus item ini?')) return;
            const idx = parseInt(e.currentTarget.dataset.index);
            arrayData.splice(idx, 1);
            mountUI();
          });
        });
      }
    };

    mountUI();

  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load game data: ${err.message}</p></div></div>`;
  }
}
