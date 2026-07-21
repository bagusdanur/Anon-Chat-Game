/**
 * classes.js — RPG Classes Manager
 */
import API from '../api.js';

let _classes = [];

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="skeleton" style="height:300px"></div></div>`;
  
  try {
    _classes = await API.get('/api/classes');
    
    container.innerHTML = `
      <div class="page-enter">
        <div class="card" style="margin-bottom:20px">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center">
            <div class="card-title">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path></svg>
              RPG Classes
            </div>
            <button class="btn btn-primary" onclick="window.addClass()">+ New Class</button>
          </div>
          <div class="card-body">
            <p style="color:var(--muted);font-size:12px;margin-bottom:15px">Warning: Menghapus class yang sedang dipakai user bisa menyebabkan error. Pastikan reset DB jika mengubah drastis.</p>
            <div id="classesList" style="display:flex;flex-direction:column;gap:15px"></div>
          </div>
          <div class="card-footer">
            <button class="btn btn-green" onclick="window.saveClasses()">Save All Changes</button>
          </div>
        </div>
      </div>
    `;

    renderList();

    window.addClass = () => {
      _classes.push({
        id: "new_class_" + Date.now(),
        name: "❓ New Class",
        damageType: "physical",
        base_hp: 40, base_atk: 5, base_def: 5, base_magic_atk: 0,
        base_crit_rate: 0.05, base_crit_multi: 1.5,
        growth: { hp: 5, atk: 1, def: 1, magic_atk: 0 },
        physBonus: 1.0, magicBonus: 1.0,
        skillName: "Tackle", skillMulti: 1.5, skillType: "physical", skillDesc: "Serangan biasa"
      });
      renderList();
    };

    window.deleteClass = (index) => {
      if (confirm('Yakin ingin menghapus class ini?')) {
        _classes.splice(index, 1);
        renderList();
      }
    };

    window.updateClass = (index, field, value) => {
      if (field.startsWith('growth.')) {
        const k = field.split('.')[1];
        _classes[index].growth[k] = parseFloat(value) || 0;
      } else if (['base_hp', 'base_atk', 'base_def', 'base_magic_atk', 'base_crit_rate', 'base_crit_multi', 'physBonus', 'magicBonus', 'skillMulti'].includes(field)) {
        _classes[index][field] = parseFloat(value) || 0;
      } else {
        _classes[index][field] = value;
      }
    };

    window.saveClasses = async () => {
      const btn = document.querySelector('.btn-green');
      btn.innerHTML = 'Saving...';
      try {
        await API.post('/api/classes', { classes: _classes });
        window.showToast('Classes saved successfully!', 'success');
      } catch(e) {
        window.showToast(e.message, 'error');
      }
      btn.innerHTML = 'Save All Changes';
    };

  } catch (err) {
    container.innerHTML = `<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load classes: ${err.message}</p></div></div>`;
  }
}

function renderList() {
  const container = document.getElementById('classesList');
  if (!container) return;
  
  container.innerHTML = _classes.map((cls, i) => `
    <div class="card" style="margin-bottom:20px;position:relative">
      <button class="btn btn-danger" style="position:absolute;top:15px;right:15px;padding:6px 12px;min-width:0;z-index:10" onclick="window.deleteClass(${i})">X</button>
      
      <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="form-group" style="margin:0">
          <label class="form-label">ID (Unik)</label>
          <input type="text" class="form-control" value="${cls.id}" onchange="window.updateClass(${i}, 'id', this.value)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Display Name (Emoji + Nama)</label>
          <input type="text" class="form-control" value="${cls.name}" onchange="window.updateClass(${i}, 'name', this.value)">
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Base HP / ATK / DEF / Magic</label>
          <div style="display:flex;gap:10px">
            <input type="number" class="form-control" placeholder="HP" value="${cls.base_hp}" onchange="window.updateClass(${i}, 'base_hp', this.value)">
            <input type="number" class="form-control" placeholder="ATK" value="${cls.base_atk}" onchange="window.updateClass(${i}, 'base_atk', this.value)">
            <input type="number" class="form-control" placeholder="DEF" value="${cls.base_def}" onchange="window.updateClass(${i}, 'base_def', this.value)">
            <input type="number" class="form-control" placeholder="MAG" value="${cls.base_magic_atk}" onchange="window.updateClass(${i}, 'base_magic_atk', this.value)">
          </div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Growth (HP / ATK / DEF / Magic) per level</label>
          <div style="display:flex;gap:10px">
            <input type="number" class="form-control" placeholder="HP+" step="0.1" value="${cls.growth.hp}" onchange="window.updateClass(${i}, 'growth.hp', this.value)">
            <input type="number" class="form-control" placeholder="ATK+" step="0.1" value="${cls.growth.atk}" onchange="window.updateClass(${i}, 'growth.atk', this.value)">
            <input type="number" class="form-control" placeholder="DEF+" step="0.1" value="${cls.growth.def}" onchange="window.updateClass(${i}, 'growth.def', this.value)">
            <input type="number" class="form-control" placeholder="MAG+" step="0.1" value="${cls.growth.magic_atk}" onchange="window.updateClass(${i}, 'growth.magic_atk', this.value)">
          </div>
        </div>
        <div class="form-group" style="grid-column:1 / -1;border-top:2px solid var(--border-dark);padding-top:15px;margin:0">
          <label class="form-label">Skill Name, Description & Multiplier</label>
          <div style="display:flex;gap:15px">
            <input type="text" class="form-control" style="flex:1" placeholder="Skill Name" value="${cls.skillName}" onchange="window.updateClass(${i}, 'skillName', this.value)">
            <input type="text" class="form-control" style="flex:2" placeholder="Description" value="${cls.skillDesc}" onchange="window.updateClass(${i}, 'skillDesc', this.value)">
            <input type="number" class="form-control" style="width:100px" step="0.1" placeholder="Mult" value="${cls.skillMulti}" onchange="window.updateClass(${i}, 'skillMulti', this.value)" title="Skill Multiplier">
          </div>
        </div>
      </div>
    </div>
  `).join('');
}
