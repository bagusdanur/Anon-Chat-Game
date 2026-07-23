import{a as e,c as t,i as n,l as r,n as i,r as a,s as o,t as s,u as c}from"./index-DygV-4TP.js";async function l(t){t.innerHTML=`<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${p(`package`)} Items Catalog</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="items-add">${p(`plus`)} Tambah</button>
        <button class="btn btn-outline btn-sm" id="items-refresh">${p(`refresh-cw`)}</button>
      </div>
    </div>
    <div id="items-table">${e(6)}</div>
  </div></div>`,document.getElementById(`items-refresh`).onclick=()=>d(t),document.getElementById(`items-add`).onclick=()=>f(t),await d(t)}function u(){}async function d(n){let r=document.getElementById(`items-table`);if(r){r.innerHTML=e(6);try{if(h=await t.get(`/api/items`),n.querySelector(`.card-title`).innerHTML=`${p(`package`)} Items Catalog (${h.length})`,!h.length){r.innerHTML=`<div class="empty-state">${m(`package`)}<p>Belum ada item</p></div>`;return}r.innerHTML=`
      <div class="form-row" style="background:var(--surface-2);border-bottom:2px solid var(--border-dark)">
        <input type="text" id="filter-search" class="form-control" placeholder="Cari nama/ID item..." style="flex:2">
        <select id="filter-cat" class="form-control" style="flex:1">
          <option value="">Semua Kategori</option>
          <option value="consumable">Consumable</option>
          <option value="material">Material</option>
          <option value="weapon">Weapon</option>
          <option value="staff">Staff</option>
          <option value="armor">Armor</option>
          <option value="accessory">Accessory</option>
        </select>
        <select id="filter-rarity" class="form-control" style="flex:1">
          <option value="">Semua Rarity</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Item ID</th><th>Nama</th><th>Kategori</th><th>Rarity</th><th>Harga</th><th>Aksi</th></tr></thead>
          <tbody id="items-tbody"></tbody>
        </table>
      </div>
    `;let e=document.getElementById(`filter-search`),a=document.getElementById(`filter-cat`),s=document.getElementById(`filter-rarity`),c=()=>{let r=e.value.toLowerCase(),c=a.value,l=s.value,u=h.filter(e=>!(r&&!e.item_id.toLowerCase().includes(r)&&!e.display_name.toLowerCase().includes(r)||c&&e.category!==c||l&&e.rarity!==l)),f=e=>e===`weapon`?`badge-red`:e===`armor`?`badge-blue`:e===`staff`?`badge-accent`:e===`consumable`?`badge-green`:`badge-gray`,m=e=>e===`legendary`?`badge-orange`:e===`epic`?`badge-accent`:e===`rare`?`badge-blue`:e===`uncommon`?`badge-green`:`badge-gray`;document.getElementById(`items-tbody`).innerHTML=u.map(e=>`
        <tr>
          <td><code style="color:var(--accent);font-size:12px">${e.item_id}</code></td>
          <td><strong>${e.display_name}</strong></td>
          <td><span class="badge ${f(e.category)}">${e.category}</span></td>
          <td><span class="badge ${m(e.rarity)}">${e.rarity}</span></td>
          <td>${e.sell_price}g</td>
          <td>
            <button class="btn btn-danger btn-sm" data-del="${e.item_id}">${p(`trash-2`)}</button>
          </td>
        </tr>`).join(``),document.querySelectorAll(`#items-tbody [data-del]`).forEach(e=>{e.onclick=()=>i(`Hapus item <code>${e.dataset.del}</code>?`,async()=>{await t.del(`/api/items/${e.dataset.del}`),o(`Item dihapus`),d(n)})}),window.lucide&&lucide.createIcons({scope:document.getElementById(`items-tbody`)})};e.oninput=c,a.onchange=c,s.onchange=c,c()}catch(e){r.innerHTML=`<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`}}}function f(e){n(`${p(`plus`)} Tambah Item`,`
    <div style="display:flex;flex-direction:column;gap:10px;padding:4px">
      <div class="form-group">
        <label class="form-label">Item ID</label>
        <input class="form-control" id="ai-id" placeholder="item_id unik (tanpa spasi)">
      </div>
      <div class="form-group">
        <label class="form-label">Display Name</label>
        <input class="form-control" id="ai-name" placeholder="Nama item">
      </div>
      <div class="form-group">
        <label class="form-label">Kategori</label>
        <select class="form-control" id="ai-cat">
          <option value="consumable">Consumable</option>
          <option value="material">Material</option>
          <option value="weapon">Weapon</option>
          <option value="staff">Staff</option>
          <option value="armor">Armor</option>
          <option value="accessory">Accessory</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Rarity</label>
        <select class="form-control" id="ai-rarity">
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="epic">Epic</option>
          <option value="legendary">Legendary</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Harga Jual</label>
        <input class="form-control" type="number" id="ai-price" value="0" min="0">
      </div>
    </div>`,`<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="ai-save">${p(`save`)} Simpan</button>`),document.getElementById(`ai-save`).onclick=async()=>{let n={item_id:document.getElementById(`ai-id`)?.value?.trim(),display_name:document.getElementById(`ai-name`)?.value?.trim(),category:document.getElementById(`ai-cat`)?.value,rarity:document.getElementById(`ai-rarity`)?.value,sell_price:parseInt(document.getElementById(`ai-price`)?.value||`0`)};if(!n.item_id||!n.display_name){o(`Item ID dan nama wajib diisi`,`warning`);return}try{await t.post(`/api/items`,n),o(`Item ditambahkan`),s(),d(e)}catch(e){o(e.message,`error`)}},window.lucide&&lucide.createIcons({scope:document.getElementById(`modal-overlay`)})}function p(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`}function m(e){return`<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${e}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`}var h;c((()=>{r(),a(),h=[]}))();export{u as cleanup,l as render};