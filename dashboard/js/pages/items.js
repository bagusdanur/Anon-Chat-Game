/**
 * items.js — Items catalog management
 */
import API from '../api.js';
import { toast, openModal, closeModal, confirm, skeletonRows } from '../components.js';

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('package')} Items Catalog</div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary btn-sm" id="items-add">${ic('plus')} Tambah</button>
        <button class="btn btn-outline btn-sm" id="items-refresh">${ic('refresh-cw')}</button>
      </div>
    </div>
    <div id="items-table">${skeletonRows(6)}</div>
  </div></div>`;

  document.getElementById('items-refresh').onclick = () => load(container);
  document.getElementById('items-add').onclick = () => addModal(container);
  await load(container);
}

export function cleanup() {}

let allItems = [];

async function load(container) {
  const el = document.getElementById('items-table');
  if (!el) return;
  el.innerHTML = skeletonRows(6);
  try {
    allItems = await API.get('/api/items');
    container.querySelector('.card-title').innerHTML = `${ic('package')} Items Catalog (${allItems.length})`;

    if (!allItems.length) {
      el.innerHTML = `<div class="empty-state">${ic48('package')}<p>Belum ada item</p></div>`;
      return;
    }

    const filterUI = `
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
    `;
    
    el.innerHTML = filterUI;
    
    const searchInput = document.getElementById('filter-search');
    const catSelect = document.getElementById('filter-cat');
    const raritySelect = document.getElementById('filter-rarity');
    
    const renderTable = () => {
      const q = searchInput.value.toLowerCase();
      const c = catSelect.value;
      const r = raritySelect.value;
      
      const filtered = allItems.filter(i => {
        if (q && !i.item_id.toLowerCase().includes(q) && !i.display_name.toLowerCase().includes(q)) return false;
        if (c && i.category !== c) return false;
        if (r && i.rarity !== r) return false;
        return true;
      });
      
      const catBadge = cat => cat === 'weapon' ? 'badge-red' : cat === 'armor' ? 'badge-blue' : cat === 'staff' ? 'badge-accent' : cat === 'consumable' ? 'badge-green' : 'badge-gray';
      const rarBadge = rar => rar === 'legendary' ? 'badge-orange' : rar === 'epic' ? 'badge-accent' : rar === 'rare' ? 'badge-blue' : rar === 'uncommon' ? 'badge-green' : 'badge-gray';
      
      document.getElementById('items-tbody').innerHTML = filtered.map(i => `
        <tr>
          <td><code style="color:var(--accent);font-size:12px">${i.item_id}</code></td>
          <td><strong>${i.display_name}</strong></td>
          <td><span class="badge ${catBadge(i.category)}">${i.category}</span></td>
          <td><span class="badge ${rarBadge(i.rarity)}">${i.rarity}</span></td>
          <td>${i.sell_price}g</td>
          <td>
            <button class="btn btn-danger btn-sm" data-del="${i.item_id}">${ic('trash-2')}</button>
          </td>
        </tr>`).join('');
        
      document.querySelectorAll('#items-tbody [data-del]').forEach(btn => {
        btn.onclick = () => confirm(`Hapus item <code>${btn.dataset.del}</code>?`, async () => {
          await API.del(`/api/items/${btn.dataset.del}`);
          toast('Item dihapus'); load(container);
        });
      });
      if (window.lucide) lucide.createIcons({ scope: document.getElementById('items-tbody') });
    };

    searchInput.oninput = renderTable;
    catSelect.onchange = renderTable;
    raritySelect.onchange = renderTable;
    
    renderTable(); // initial render

  } catch(e) {
    el.innerHTML = `<div class="card-body" style="color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function addModal(container) {
  openModal(`${ic('plus')} Tambah Item`, `
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
    </div>`,
    `<button class="btn btn-outline" onclick="closeModal()">Batal</button>
     <button class="btn btn-primary" id="ai-save">${ic('save')} Simpan</button>`
  );
  document.getElementById('ai-save').onclick = async () => {
    const d = {
      item_id:      document.getElementById('ai-id')?.value?.trim(),
      display_name: document.getElementById('ai-name')?.value?.trim(),
      category:     document.getElementById('ai-cat')?.value,
      rarity:       document.getElementById('ai-rarity')?.value,
      sell_price:   parseInt(document.getElementById('ai-price')?.value || '0')
    };
    if (!d.item_id || !d.display_name) { toast('Item ID dan nama wajib diisi', 'warning'); return; }
    try {
      await API.post('/api/items', d);
      toast('Item ditambahkan'); closeModal(); load(container);
    } catch(e) { toast(e.message, 'error'); }
  };
  if (window.lucide) lucide.createIcons({ scope: document.getElementById('modal-overlay') });
}

function ic(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
