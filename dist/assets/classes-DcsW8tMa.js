import{c as e,l as t,u as n}from"./index-DUqRozNy.js";async function r(t){t.innerHTML=`<div class="page-enter"><div class="skeleton" style="height:300px"></div></div>`;try{a=await e.get(`/api/classes`),t.innerHTML=`
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
    `,i(),window.addClass=()=>{a.push({id:`new_class_`+Date.now(),name:`❓ New Class`,damageType:`physical`,base_hp:40,base_atk:5,base_def:5,base_magic_atk:0,base_crit_rate:.05,base_crit_multi:1.5,growth:{hp:5,atk:1,def:1,magic_atk:0},physBonus:1,magicBonus:1,skillName:`Tackle`,skillMulti:1.5,skillType:`physical`,skillDesc:`Serangan biasa`}),i()},window.deleteClass=e=>{confirm(`Yakin ingin menghapus class ini?`)&&(a.splice(e,1),i())},window.updateClass=(e,t,n)=>{if(t.startsWith(`growth.`)){let r=t.split(`.`)[1];a[e].growth[r]=parseFloat(n)||0}else[`base_hp`,`base_atk`,`base_def`,`base_magic_atk`,`base_crit_rate`,`base_crit_multi`,`physBonus`,`magicBonus`,`skillMulti`].includes(t)?a[e][t]=parseFloat(n)||0:a[e][t]=n},window.saveClasses=async()=>{let t=document.querySelector(`.btn-green`);t.innerHTML=`Saving...`;try{await e.post(`/api/classes`,{classes:a}),window.showToast(`Classes saved successfully!`,`success`)}catch(e){window.showToast(e.message,`error`)}t.innerHTML=`Save All Changes`}}catch(e){t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load classes: ${e.message}</p></div></div>`}}function i(){let e=document.getElementById(`classesList`);e&&(e.innerHTML=a.map((e,t)=>`
    <div style="border:2px solid var(--border-dark);background:var(--surface);padding:15px;position:relative">
      <button class="btn btn-red" style="position:absolute;top:15px;right:15px;padding:5px 10px;min-width:0" onclick="window.deleteClass(${t})">X</button>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:15px">
        <div>
          <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px">ID (Unik)</label>
          <input type="text" class="input" value="${e.id}" onchange="window.updateClass(${t}, 'id', this.value)">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px">Display Name (Emoji + Nama)</label>
          <input type="text" class="input" value="${e.name}" onchange="window.updateClass(${t}, 'name', this.value)">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px">Base HP / ATK / DEF / Magic</label>
          <div style="display:flex;gap:5px">
            <input type="number" class="input" style="padding:4px" value="${e.base_hp}" onchange="window.updateClass(${t}, 'base_hp', this.value)">
            <input type="number" class="input" style="padding:4px" value="${e.base_atk}" onchange="window.updateClass(${t}, 'base_atk', this.value)">
            <input type="number" class="input" style="padding:4px" value="${e.base_def}" onchange="window.updateClass(${t}, 'base_def', this.value)">
            <input type="number" class="input" style="padding:4px" value="${e.base_magic_atk}" onchange="window.updateClass(${t}, 'base_magic_atk', this.value)">
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px">Growth (HP / ATK / DEF / Magic) per level</label>
          <div style="display:flex;gap:5px">
            <input type="number" class="input" style="padding:4px" step="0.1" value="${e.growth.hp}" onchange="window.updateClass(${t}, 'growth.hp', this.value)">
            <input type="number" class="input" style="padding:4px" step="0.1" value="${e.growth.atk}" onchange="window.updateClass(${t}, 'growth.atk', this.value)">
            <input type="number" class="input" style="padding:4px" step="0.1" value="${e.growth.def}" onchange="window.updateClass(${t}, 'growth.def', this.value)">
            <input type="number" class="input" style="padding:4px" step="0.1" value="${e.growth.magic_atk}" onchange="window.updateClass(${t}, 'growth.magic_atk', this.value)">
          </div>
        </div>
        <div style="grid-column:1 / -1;border-top:1px solid var(--border-dark);padding-top:10px;margin-top:5px">
          <label style="display:block;font-size:12px;font-weight:bold;margin-bottom:4px">Skill Name & Description</label>
          <div style="display:flex;gap:10px">
            <input type="text" class="input" style="flex:1" value="${e.skillName}" onchange="window.updateClass(${t}, 'skillName', this.value)">
            <input type="text" class="input" style="flex:2" value="${e.skillDesc}" onchange="window.updateClass(${t}, 'skillDesc', this.value)">
            <input type="number" class="input" style="width:80px" step="0.1" value="${e.skillMulti}" onchange="window.updateClass(${t}, 'skillMulti', this.value)" title="Skill Multiplier">
          </div>
        </div>
      </div>
    </div>
  `).join(``))}var a;n((()=>{t(),a=[]}))();export{r as render};