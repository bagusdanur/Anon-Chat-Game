/**
 * wordfilter.js — Word filter management
 */
import API from '../api.js';
import { toast } from '../components.js';

let _words = [];

export async function render(container) {
  container.innerHTML = `<div class="page-enter"><div class="card">
    <div class="card-header">
      <div class="card-title">${ic('shield-ban')} Word Filter</div>
      <span id="wf-count" class="badge badge-gray">-</span>
    </div>
    <div class="form-row">
      <input class="form-control" id="wf-new" placeholder="Tambah kata terlarang…" style="flex:1">
      <button class="btn btn-primary" id="wf-add">${ic('plus')} Tambah</button>
    </div>
    <div id="wf-tags"><div style="padding:16px;color:var(--muted)">Memuat…</div></div>
  </div></div>`;

  document.getElementById('wf-add').onclick = addWord;
  document.getElementById('wf-new').onkeydown = (e) => { if (e.key === 'Enter') addWord(); };
  await load(container);
  if (window.lucide) lucide.createIcons({ scope: container });
}

export function cleanup() { _words = []; }

async function load(container) {
  try {
    const d = await API.get('/api/wordfilter');
    _words = d.words || [];
    render_tags(container);
  } catch(e) {
    document.getElementById('wf-tags').innerHTML = `<div style="padding:16px;color:var(--red)">Gagal: ${e.message}</div>`;
  }
}

function render_tags(container) {
  const el = document.getElementById('wf-tags');
  const countEl = document.getElementById('wf-count');
  if (countEl) countEl.textContent = _words.length + ' kata';

  if (!_words.length) {
    el.innerHTML = `<div class="empty-state">${ic48('shield-check')}<p>Belum ada kata terlarang</p></div>`;
    return;
  }

  el.innerHTML = `<div class="tag-cloud">
    ${_words.map((w, i) => `
      <span class="tag">
        ${w}
        <span class="tag-rm" data-idx="${i}" title="Hapus">×</span>
      </span>`).join('')}
  </div>`;

  el.querySelectorAll('[data-idx]').forEach(btn => {
    btn.onclick = () => removeWord(parseInt(btn.dataset.idx), container);
  });
  if (window.lucide) lucide.createIcons({ scope: container });
}

function addWord() {
  const input = document.getElementById('wf-new');
  const w = input.value.trim().toLowerCase();
  if (!w) { toast('Kata tidak boleh kosong', 'warning'); return; }
  if (_words.includes(w)) { toast('Kata sudah ada', 'warning'); return; }
  _words.push(w);
  input.value = '';
  saveWords();
}

function removeWord(idx, container) {
  _words.splice(idx, 1);
  saveWords();
}

async function saveWords() {
  try {
    await API.post('/api/wordfilter', { words: _words });
    toast('Word filter diperbarui');
    render_tags(document.querySelector('.page-enter'));
  } catch(e) { toast(e.message, 'error'); }
}

function ic(n)   { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
function ic48(n) { return `<svg xmlns="http://www.w3.org/2000/svg" data-lucide="${n}" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></svg>`; }
