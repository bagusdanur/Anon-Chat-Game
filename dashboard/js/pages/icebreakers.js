/**
 * icebreakers.js — Icebreaker questions management
 */
import API from '../api.js';
import { toast } from '../components.js';

let _questions = [];

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('message-circle')} Icebreakers</div>
      <span id="ice-count" class="badge badge-gray">-</span>
    </div>
    <div class="form-row">
      <input class="form-control" id="ice-new" placeholder="Tambah pertanyaan baru…" style="flex:1">
      <button class="btn btn-primary" id="ice-add">${ic('plus')} Tambah</button>
    </div>
    <div id="ice-list"><div style="padding:16px;color:var(--muted)">Memuat…</div></div>
  </div></div>`;

  document.getElementById('ice-add').onclick = addQ;
  document.getElementById('ice-new').onkeydown = (e) => { if (e.key === 'Enter') addQ(); };
  await load(container);
  if (window.lucide) lucide.createIcons({ scope: container });
}

export function cleanup() { _questions = []; }

async function load(container) {
  try {
    const d = await API.get('/api/icebreakers');
    _questions = d.questions || [];
    renderList(container);
  } catch(e) {
    document.getElementById('ice-list').innerHTML = `<div style="padding:16px;color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function renderList(container) {
  const el = document.getElementById('ice-list');
  const countEl = document.getElementById('ice-count');
  if (countEl) countEl.textContent = _questions.length + ' pertanyaan';

  if (!_questions.length) {
    el.innerHTML = `<div class="empty-state">${ic48('message-circle')}<p>Belum ada pertanyaan</p></div>`;
    return;
  }

  el.innerHTML = `<div class="tag-cloud" style="flex-direction:column;gap:6px">
    ${_questions.map((q, i) => `
      <span class="tag" style="width:100%;justify-content:space-between;padding:10px 14px">
        <span style="font-size:13px;flex:1;line-height:1.4">${q}</span>
        <span class="tag-rm" data-idx="${i}" title="Hapus">×</span>
      </span>`).join('')}
  </div>`;

  el.querySelectorAll('[data-idx]').forEach(btn => {
    btn.onclick = () => { _questions.splice(parseInt(btn.dataset.idx), 1); saveQuestions(container); };
  });
}

function addQ() {
  const input = document.getElementById('ice-new');
  const q = input.value.trim();
  if (!q) { toast('Pertanyaan tidak boleh kosong', 'warning'); return; }
  _questions.push(q);
  input.value = '';
  saveQuestions(document.querySelector('.page-enter'));
}

async function saveQuestions(container) {
  try {
    await API.post('/api/icebreakers', { questions: _questions });
    toast('Icebreakers diperbarui');
    renderList(container);
  } catch(e) { toast(e.message, 'error'); }
}

function ic(n)   { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
