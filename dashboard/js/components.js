/**
 * components.js — Shared UI components
 * Toast notifications + Modal dialog
 */

/* ============================================================
   TOAST
   ============================================================ */
let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.getElementById('toast-container');
  }
  return _toastContainer;
}

/**
 * Show a toast notification
 * @param {string} msg
 * @param {'success'|'error'|'info'|'warning'} type
 * @param {number} duration ms
 */
export function toast(msg, type = 'success', duration = 3000) {
  const container = getToastContainer();
  const icons = {
    success: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`,
    error:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`,
    warning: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`,
  };

  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `${icons[type] || ''}<span class="toast-msg">${msg}</span>`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
}

/* ============================================================
   MODAL
   ============================================================ */
let _overlay, _modalTitle, _modalBody, _modalFooter;

function getModalEls() {
  if (!_overlay) {
    _overlay      = document.getElementById('modal-overlay');
    _modalTitle   = document.getElementById('modal-title');
    _modalBody    = document.getElementById('modal-body');
    _modalFooter  = document.getElementById('modal-footer');
  }
  return { _overlay, _modalTitle, _modalBody, _modalFooter };
}

/**
 * Open the modal
 * @param {string} title
 * @param {string} bodyHTML
 * @param {string} footerHTML
 */
export function openModal(title, bodyHTML, footerHTML = '') {
  const { _overlay, _modalTitle, _modalBody, _modalFooter } = getModalEls();
  _modalTitle.innerHTML  = title;
  _modalBody.innerHTML   = bodyHTML;
  _modalFooter.innerHTML = footerHTML;
  _overlay.classList.add('show');
  // Re-render lucide icons inside modal
  if (window.lucide) lucide.createIcons({ scope: _overlay });
}

export function closeModal() {
  const { _overlay } = getModalEls();
  _overlay.classList.remove('show');
}

/* ============================================================
   CONFIRM DIALOG
   ============================================================ */
export function confirm(msg, onConfirm, danger = true) {
  openModal(
    'Konfirmasi',
    `<p style="font-size:15px;line-height:1.6">${msg}</p>`,
    `<button class="btn btn-outline" id="confirm-cancel">Batal</button>
     <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-ok">Ya, Lanjutkan</button>`
  );
  document.getElementById('confirm-cancel').onclick = closeModal;
  document.getElementById('confirm-ok').onclick = () => { closeModal(); onConfirm(); };
}

/* ============================================================
   LOADING HELPERS
   ============================================================ */
export function skeletonRows(count = 5, cols = 5) {
  return `<div style="padding:8px">
    ${Array.from({ length: count }, () =>
      `<div class="skeleton skeleton-row" style="margin-bottom:3px"></div>`
    ).join('')}
  </div>`;
}

export function skeletonStats(count = 4) {
  return `<div class="stats-grid">
    ${Array.from({ length: count }, () =>
      `<div class="skeleton skeleton-stat"></div>`
    ).join('')}
  </div>`;
}
