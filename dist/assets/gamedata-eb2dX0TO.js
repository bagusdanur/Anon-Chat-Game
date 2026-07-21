import{c as e,l as t,u as n}from"./index-25s4ACC6.js";async function r(t){t.innerHTML=`<div class="page-enter"><div class="skeleton" style="height:400px"></div></div>`;try{let[n,r,i,a,o]=await Promise.all([e.get(`/api/bosses`),e.get(`/api/monsters`),e.get(`/api/shops`),e.get(`/api/crafting`),e.get(`/api/quests`)]),s={bosses:{title:`Bosses`,data:n,endpoint:`/api/bosses`},monsters:{title:`Monsters`,data:r,endpoint:`/api/monsters`},shops:{title:`Shops`,data:i,endpoint:`/api/shops`},crafting:{title:`Crafting`,data:a,endpoint:`/api/crafting`},quests:{title:`Quests`,data:o,endpoint:`/api/quests`}},c=`bosses`,l=`form`,u=()=>{let e=`<div class="tabs" style="display:flex;gap:10px;margin-bottom:15px;border-bottom:2px solid var(--border);padding-bottom:10px">`;for(let t of Object.keys(s))e+=`<button class="btn btn-${t===c?`primary`:`secondary`} tab-btn" data-tab="${t}">${s[t].title}</button>`;return e+=`</div>`,e},d=()=>{let e=s[c],t=`
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
          <h3 style="margin:0">Edit ${e.title}</h3>
          <div class="tabs" style="display:flex;gap:5px;">
            <button class="btn btn-${l===`form`?`primary`:`outline`} mode-btn" data-mode="form"><i data-lucide="list"></i> Form Mode</button>
            <button class="btn btn-${l===`json`?`primary`:`outline`} mode-btn" data-mode="json"><i data-lucide="code"></i> JSON Mode</button>
          </div>
        </div>
      `;if(l===`json`)return t+`
          <div class="card">
            <div class="card-header">
              <span style="font-size:12px;color:var(--muted)">Hati-hati, format JSON harus valid!</span>
            </div>
            <div class="card-body">
              <textarea id="jsonEditor" class="form-control" style="font-family:monospace;min-height:400px;font-size:13px;background:var(--bg-card);color:var(--text);border:2px solid var(--border)">${JSON.stringify(e.data,null,2)}</textarea>
              <div style="margin-top:15px;display:flex;gap:10px;">
                <button id="saveJsonBtn" class="btn btn-primary">Save ${e.title}</button>
                <button id="formatBtn" class="btn btn-secondary">Format JSON</button>
              </div>
              <div id="errorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
            </div>
          </div>
        `;{let n=Object.keys(e.data),r=`<div class="card" style="background:transparent;border:none"><div class="card-body" style="padding:0"><div id="formEditorContainer" style="display:flex;flex-direction:column;gap:30px;">`;return n.forEach(t=>{let n=e.data[t];Array.isArray(n)&&(r+=`<div style="padding:15px; background:var(--bg); border:1px solid var(--border); border-radius:8px;">`,r+=`<h4 style="margin-top:0;margin-bottom:15px;color:var(--primary);text-transform:capitalize;">${t.replace(/_/g,` `)}</h4>`,r+=`<div style="display:flex;flex-direction:column;gap:15px;">`,n.forEach((e,n)=>{r+=`<div class="card" style="border:2px solid var(--border); box-shadow:none">
              <div class="card-header" style="display:flex;justify-content:space-between;padding:10px 15px;">
                <strong>Item #${n+1}</strong>
                <button class="btn btn-danger btn-sm remove-item-btn" data-key="${t}" data-index="${n}"><i data-lucide="trash-2"></i></button>
              </div>
              <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;for(let[i,a]of Object.entries(e)){let e=typeof a;a!==null&&e===`object`?r+=`<div class="form-group" style="grid-column: span 2">
                  <label class="form-label">${i} <span style="color:var(--muted);font-weight:normal">(JSON Object/Array)</span></label>
                  <textarea class="form-control form-field-input" data-main="${t}" data-index="${n}" data-key="${i}" data-type="object" style="font-family:monospace" rows="3">${JSON.stringify(a)}</textarea>
                </div>`:e===`boolean`?r+=`<div class="form-group">
                  <label class="form-label">${i}</label>
                  <select class="form-control form-field-input" data-main="${t}" data-index="${n}" data-key="${i}" data-type="boolean">
                    <option value="true" ${a===!0?`selected`:``}>True</option>
                    <option value="false" ${a===!1?`selected`:``}>False</option>
                  </select>
                </div>`:r+=`<div class="form-group">
                  <label class="form-label">${i}</label>
                  <input type="${e===`number`?`number`:`text`}" class="form-control form-field-input" data-main="${t}" data-index="${n}" data-key="${i}" data-type="${e}" value="${a===null?``:a}">
                </div>`}r+=`</div></div>`}),r+=`</div>
            <div style="margin-top:15px;display:flex;gap:10px;">
              <button class="btn btn-outline add-form-btn" data-key="${t}"><i data-lucide="plus"></i> Tambah Item ${t}</button>
            </div>
          </div>`)}),r+=`</div>
          <div style="margin-top:20px;display:flex;gap:10px;">
            <button id="saveFormBtn" class="btn btn-primary btn-lg"><i data-lucide="save"></i> Save ${e.title}</button>
          </div>
          <div id="formErrorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
        </div></div>`,t+r}},f=()=>{if(t.innerHTML=`
        <div class="page-enter">
          <div style="margin-bottom:20px;">
            <h2>Master Game Data</h2>
            <p style="color:var(--muted)">Edit konfigurasi seluruh data RPG secara real-time melalui Form Mode atau JSON Mode.</p>
          </div>
          ${u()}
          <div id="editorContainer">
            ${d()}
          </div>
        </div>
      `,window.lucide&&window.lucide.createIcons(),t.querySelectorAll(`.tab-btn`).forEach(e=>{e.addEventListener(`click`,e=>{c=e.target.dataset.tab,f()})}),t.querySelectorAll(`.mode-btn`).forEach(e=>{e.addEventListener(`click`,e=>{l=e.currentTarget.dataset.mode,f()})}),l===`json`){let t=document.getElementById(`saveJsonBtn`);t&&t.addEventListener(`click`,async t=>{let n=t.target,r=document.getElementById(`errorMsg`),i=document.getElementById(`jsonEditor`);r.style.display=`none`;let a;try{a=JSON.parse(i.value)}catch(e){r.textContent=`Invalid JSON: `+e.message,r.style.display=`block`;return}n.disabled=!0,n.textContent=`Saving...`;try{await e.post(s[c].endpoint,a),s[c].data=a,window.showToast(`${s[c].title} saved!`,`success`)}catch(e){window.showToast(`Failed to save: `+e.message,`error`)}finally{n.disabled=!1,n.textContent=`Save ${s[c].title}`}});let n=document.getElementById(`formatBtn`);n&&n.addEventListener(`click`,()=>{let e=document.getElementById(`jsonEditor`),t=document.getElementById(`errorMsg`);t.style.display=`none`;try{let t=JSON.parse(e.value);e.value=JSON.stringify(t,null,2)}catch(e){t.textContent=`Cannot format invalid JSON: `+e.message,t.style.display=`block`}})}else{let n=document.getElementById(`saveFormBtn`);n&&n.addEventListener(`click`,async t=>{let n=t.currentTarget,r=document.getElementById(`formErrorMsg`);r.style.display=`none`;let i=JSON.parse(JSON.stringify(s[c].data));Object.keys(i).forEach(e=>{Array.isArray(i[e])&&(i[e]=[])});let a=document.querySelectorAll(`.form-field-input`),o=!1;if(a.forEach(e=>{let t=e.dataset.main,n=parseInt(e.dataset.index),a=e.dataset.key,s=e.dataset.type;i[t]||(i[t]=[]),i[t][n]||(i[t][n]={});let c=e.value;if(s===`number`)c=c===``?null:Number(c);else if(s===`boolean`)c=c===`true`;else if(s===`object`)if(c.trim()===``)c=null;else try{c=JSON.parse(c)}catch(e){o=!0,r.textContent=`Invalid JSON in `+t+` Item #`+(n+1)+`, field '`+a+`': `+e.message,r.style.display=`block`}i[t][n][a]=c}),!o){n.disabled=!0,n.innerHTML=`Saving...`;try{await e.post(s[c].endpoint,i),s[c].data=i,window.showToast(`${s[c].title} saved via Form!`,`success`),f()}catch(e){window.showToast(`Failed to save: `+e.message,`error`)}finally{n.disabled=!1,n.innerHTML=`<i data-lucide="save"></i> Save ${s[c].title}`,window.lucide&&window.lucide.createIcons()}}}),t.querySelectorAll(`.add-form-btn`).forEach(e=>{e.addEventListener(`click`,e=>{let t=e.currentTarget.dataset.key,n=s[c].data[t];document.querySelectorAll(`.form-field-input`).forEach(e=>{let t=e.dataset.main,n=parseInt(e.dataset.index),r=e.dataset.key,i=e.value;if(e.dataset.type===`object`)try{i=JSON.parse(i)}catch{}else e.dataset.type===`number`?i=Number(i):e.dataset.type===`boolean`&&(i=i===`true`);s[c].data[t][n]&&(s[c].data[t][n][r]=i)});let r={};n.length>0&&Object.keys(n[0]).forEach(e=>{let t=typeof n[0][e];t===`number`?r[e]=0:t===`boolean`?r[e]=!1:Array.isArray(n[0][e])?r[e]=[]:t===`object`&&n[0][e]!==null?r[e]={}:r[e]=``}),n.push(r),f()})}),t.querySelectorAll(`.remove-item-btn`).forEach(e=>{e.addEventListener(`click`,e=>{if(!confirm(`Hapus item ini?`))return;let t=e.currentTarget.dataset.key,n=parseInt(e.currentTarget.dataset.index);s[c].data[t].splice(n,1),f()})})}};f()}catch(e){t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load game data: ${e.message}</p></div></div>`}}n((()=>{t()}))();export{r as render};