import{c as e,l as t,u as n}from"./index-CS_7gALt.js";async function r(t){t.innerHTML=`<div class="page-enter"><div class="skeleton" style="height:400px"></div></div>`;try{let[n,r,i,a,o]=await Promise.all([e.get(`/api/bosses`),e.get(`/api/monsters`),e.get(`/api/shops`),e.get(`/api/crafting`),e.get(`/api/quests`)]),s={bosses:{title:`Bosses`,data:n,endpoint:`/api/bosses`},monsters:{title:`Monsters`,data:r,endpoint:`/api/monsters`},shops:{title:`Shops`,data:i,endpoint:`/api/shops`},crafting:{title:`Crafting`,data:a,endpoint:`/api/crafting`},quests:{title:`Quests`,data:o,endpoint:`/api/quests`}},c=`bosses`,l=()=>{let e=`<div class="tabs" style="display:flex;gap:10px;margin-bottom:15px;border-bottom:2px solid var(--border);padding-bottom:10px">`;for(let t of Object.keys(s))e+=`<button class="btn btn-${t===c?`primary`:`secondary`} tab-btn" data-tab="${t}">${s[t].title}</button>`;return e+=`</div>`,e},u=()=>{let e=s[c];return`
        <div class="card">
          <div class="card-header">
            <div class="card-title">Edit ${e.title} Config (JSON)</div>
            <span style="font-size:12px;color:var(--muted)">Hati-hati, format JSON harus valid!</span>
          </div>
          <div class="card-body">
            <textarea id="jsonEditor" class="form-control" style="font-family:monospace;min-height:400px;font-size:13px;background:var(--bg-card);color:var(--text);border:2px solid var(--border)">${JSON.stringify(e.data,null,2)}</textarea>
            <div style="margin-top:15px;display:flex;gap:10px;">
              <button id="saveBtn" class="btn btn-primary">Save ${e.title}</button>
              <button id="formatBtn" class="btn btn-secondary">Format JSON</button>
            </div>
            <div id="errorMsg" style="color:var(--red);margin-top:10px;font-size:14px;font-weight:bold;display:none;"></div>
          </div>
        </div>
      `},d=()=>{t.innerHTML=`
        <div class="page-enter">
          <div style="margin-bottom:20px;">
            <h2>Master Game Data</h2>
            <p style="color:var(--muted)">Edit konfigurasi seluruh data RPG seperti monster, item shop, dan boss raid secara real-time.</p>
          </div>
          ${l()}
          <div id="editorContainer">
            ${u()}
          </div>
        </div>
      `,t.querySelectorAll(`.tab-btn`).forEach(e=>{e.addEventListener(`click`,e=>{c=e.target.dataset.tab,d()})}),document.getElementById(`saveBtn`).addEventListener(`click`,async t=>{let n=t.target,r=document.getElementById(`errorMsg`),i=document.getElementById(`jsonEditor`);r.style.display=`none`;let a;try{a=JSON.parse(i.value)}catch(e){r.textContent=`Invalid JSON: `+e.message,r.style.display=`block`;return}n.disabled=!0,n.textContent=`Saving...`;try{await e.post(s[c].endpoint,a),s[c].data=a,window.showToast(`${s[c].title} config saved!`,`success`)}catch(e){window.showToast(`Failed to save: `+e.message,`error`)}finally{n.disabled=!1,n.textContent=`Save ${s[c].title}`}}),document.getElementById(`formatBtn`).addEventListener(`click`,()=>{let e=document.getElementById(`jsonEditor`),t=document.getElementById(`errorMsg`);t.style.display=`none`;try{let t=JSON.parse(e.value);e.value=JSON.stringify(t,null,2)}catch(e){t.textContent=`Cannot format invalid JSON: `+e.message,t.style.display=`block`}})};d()}catch(e){t.innerHTML=`<div class="card"><div class="card-body"><p style="color:var(--red)">Failed to load game data: ${e.message}</p></div></div>`}}n((()=>{t()}))();export{r as render};