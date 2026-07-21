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

async function load(container) {
  const el = document.getElementById('items-table');
  if (!el) return;
  el.innerHTML = skeletonRows(6);
  try {
    const items = await API.get('/api/items');
    container.querySelector('.card-title').innerHTML = `${ic('package')} Items Catalog (${items.length})`;

    if (!items.length) {
      el.innerHTML = `<div class="empty-state">${ic48('package')}<p>Belum ada item</p></div>`;
      return;
    }

    const catBadge = c => c === 'weapon' ? 'badge-red' : c === 'armor' ? 'badge-blue' : c === 'staff' ? 'badge-accent' : c === 'consumable' ? 'badge-green' : 'badge-gray';
    const rarBadge = r => r === 'legendary' ? 'badge-orange' : r === 'epic' ? 'badge-accent' : r === 'rare' ? 'badge-blue' : r === 'uncommon' ? 'badge-green' : 'badge-gray';

    const rows = items.map(i => `
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

    el.innerHTML = `<div class="table-wrap"><table>
      <thead><tr><th>Item ID</th><th>Nama</th><th>Kategori</th><th>Rarity</th><th>Harga</th><th>Aksi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;

    el.querySelectorAll('[data-del]').forEach(btn => {
      btn.onclick = () => confirm(`Hapus item <code>${btn.dataset.del}</code>?`, async () => {
        await API.del(`/api/items/${btn.dataset.del}`);
        toast('Item dihapus'); load(container);
      });
    });
    if (window.lucide) lucide.createIcons({ scope: container });
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
