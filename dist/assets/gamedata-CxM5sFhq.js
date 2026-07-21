import{c as e,l as t,u as n}from"./index-BzmntqLX.js";async function r(t){t.innerHTML=`<div class="page-enter"><div class="skeleton" style="height:400px"></div></div>`;try{let[n,r,i,a,o]=await Promise.all([e.get(`/api/bosses`),e.get(`/api/monsters`),e.get(`/api/shops`),e.get(`/api/crafting`),e.get(`/api/quests`)]),s={bosses:{title:`Bosses`,data:n,endpoint:`/api/bosses`},monsters:{title:`Monsters`,data:r,endpoint:`/api/monsters`},shops:{title:`Shops`,data:i,endpoint:`/api/shops`},crafting:{title:`Crafting`,data:a,endpoint:`/api/crafting`},quests:{title:`Quests`,data:o,endpoint:`/api/quests`}},c=`bosses`,l=`form`,u=()=>{let e=`<div class="tabs" style="display:flex;gap:10px;margin-bottom:15px;border-bottom:2px solid var(--border);padding-bottom:10px">`;for(let t of Object.keys(s))e+=`<button class="btn btn-${t===c?`primary`:`secondary`} tab-btn" data-tab="${t}">${s[t].title}</button>`;return e+=`</div>`,e},d=()=>{let e=s[c],t=`
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
        `;{let n=Object.keys(e.data);if(n.length!==1||!Array.isArray(e.data[n[0]]))return t+`<div class="card"><div class="card-body">Struktur data ini kompleks. Silakan gunakan <b>JSON Mode</b>.</div></div>`;let r=n[0],i=e.data[r]||[],a=`<div class="card" style="background:transparent;border:none"><div class="card-body" style="padding:0"><div id="formEditorContainer" style="display:flex;flex-direction:column;gap:15px;">`;return i.forEach((e,t)=>{a+=`<div class="card" style="border:2px solid var(--border); box-shadow:none">
            <div class="card-header" style="display:flex;justify-content:space-between;padding:10px 15px;">
              <strong>Item #${t+1}</strong>
              <button class="btn btn-danger btn-sm remove-item-btn" data-index="${t}"><i data-lucide="trash-2"></i></button>
            </div>
            <div class="card-body" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`;for(let[n,r]of Object.entries(e)){let e=typeof r;r!==null&&e===`object`?a+=`<div class="form-group" style="grid-column: span 2">
                <label class="form-label">${n} <span style="color:var(--muted);font-weight:normal">(JSON Object/Array)</span></label>
                <textarea class="form-control form-field-input" data-index="${t}" data-key="${n}" data-type="object" style="font-family:monospace" rows="3">${JSON.stringify(r)}</textarea>
              </div>`:e===`boolean`?a+=`<div class="form-group">
                <label class="form-label">${n}</label>
                <select class="form-control form-field-input" data-index="${t}" data-key="${n}" data-type="boolean">
                  <option value="true" ${r===!0?`selected`:``}>True</option>
                  <option value="false" ${r===!1?`selected`:``}>False</option>
                </select>
              </div>`:a+=`<div class="form-group">
                <label class="form-label">${n}</label>
                <input type="${e===`number`?`number`:`text`}" class="form-control form-field-input" data-index="${t}" data-key="${n}" data-type="${e}" value="${r===null?``:r}">
              </div>`}a+=`</div></div>`}),a+=`</div>
          <div style="margin-top:15px;display:flex;gap:10px;">
            <button id="addFormBtn" class="btn btn-outline"><i data-lucide="plus"></i> Tambah Item Baru</button>
            <button id="saveFormBtn" class="btn btn-primary"><i data-lucide="save"></i> Save ${e.title}</button>
          </div>
          <div id="formErrorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
        </div></div>`,t+a}},f=()=>{if(t.innerHTML=`
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
      `,window.lucide&&window.lucide.createIcons(),t.querySelectorAll(`.tab-btn`).forEach(e=>{e.addEventListener(`click`,e=>{c=e.target.dataset.tab,f()})}),t.querySelectorAll(`.mode-btn`).forEach(e=>{e.addEventListener(`click`,e=>{l=e.currentTarget.dataset.mode,f()})}),l===`json`){let t=document.getElementById(`saveJsonBtn`);t&&t.addEventListener(`click`,async t=>{let n=t.target,r=document.getElementById(`errorMsg`),i=document.getElementById(`jsonEditor`);r.style.display=`none`;let a;try{a=JSON.parse(i.value)}catch(e){r.textContent=`Invalid JSON: `+e.message,r.style.display=`block`;return}n.disabled=!0,n.textContent=`Saving...`;try{await e.post(s[c].endpoint,a),s[c].data=a,window.showToast(`${s[c].title} saved!`,`success`)}catch(e){window.showToast(`Failed to save: `+e.message,`error`)}finally{n.disabled=!1,n.textContent=`Save ${s[c].title}`}});let n=document.getElementById(`formatBtn`);n&&n.addEventListener(`click`,()=>{let e=document.getElementById(`jsonEditor`),t=document.getElementById(`errorMsg`);t.style.display=`none`;try{let t=JSON.parse(e.value);e.value=JSON.stringify(t,null,2)}catch(e){t.textContent=`Cannot format invalid JSON: `+e.message,t.style.display=`block`}})}else{let n=Object.keys(s[c].data)[0],r=s[c].data[n],i=document.getElementById(`saveFormBtn`);i&&i.addEventListener(`click`,async t=>{let r=t.currentTarget,i=document.getElementById(`formErrorMsg`);i.style.display=`none`;let a=[],o=document.querySelectorAll(`.form-field-input`),l=!1;if(o.forEach(e=>{let t=parseInt(e.dataset.index),n=e.dataset.key,r=e.dataset.type;a[t]||(a[t]={});let o=e.value;if(r===`number`)o=o===``?null:Number(o);else if(r===`boolean`)o=o===`true`;else if(r===`object`)if(o.trim()===``)o=null;else try{o=JSON.parse(o)}catch(e){l=!0,i.textContent=`Invalid JSON in Item #`+(t+1)+`, field '`+n+`': `+e.message,i.style.display=`block`}a[t][n]=o}),l)return;let u={...s[c].data,[n]:a};r.disabled=!0,r.innerHTML=`Saving...`;try{await e.post(s[c].endpoint,u),s[c].data=u,window.showToast(`${s[c].title} saved via Form!`,`success`),f()}catch(e){window.showToast(`Failed to save: `+e.message,`error`)}finally{r.disabled=!1,r.innerHTML=`<i data-lucide="save"></i> Save ${s[c].title}`,window.lucide&&window.lucide.createIcons()}});let a=document.getElementById(`addFormBtn`);a&&a.addEventListener(`click`,()=>{document.querySelectorAll(`.form-field-input`).forEach(e=>{let t=parseInt(e.dataset.index),n=e.dataset.key,i=e.value;if(e.dataset.type===`object`)try{i=JSON.parse(i)}catch{}else e.dataset.type===`number`?i=Number(i):e.dataset.type===`boolean`&&(i=i===`true`);r[t]&&(r[t][n]=i)});let e={};r.length>0&&Object.keys(r[0]).forEach(t=>{let n=typeof r[0][t];n===`number`?e[t]=0:n===`boolean`?e[t]=!1:Array.isArray(r[0][t])?e[t]=[]:n===`object`&&r[0][t]!==null?e[t]={}:e[t]=``}),r.push(e),f()}),t.querySelectorAll(`.remove-item-btn`).forEach(e=>{e.addEventListener(`click`,e=>{if(!confirm(`Hapus item ini?`))return;let t=parseInt(e.currentTarget.dataset.index);r.splice(t,1),f()})})}};f()}catch(e){t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load game data: ${e.message}</p></div></div>`}}n((()=>{t()}))();export{r as render};