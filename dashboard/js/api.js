/**
 * api.js — Centralized API client
 * Handles auth headers, 401 redirect, error normalization
 */

const API = {
  _token: sessionStorage.getItem('auth'),

  get token() { return this._token; },
  set token(val) {
    this._token = val;
    if (val) sessionStorage.setItem('auth', val);
    else sessionStorage.removeItem('auth');
  },

  get isAuth() { return !!this._token; },

  get headers() {
    return {
      'Authorization': 'Basic ' + this._token,
      'Content-Type': 'application/json'
    };
  },

  async _fetch(url, opts = {}) {
    const res = await fetch(url, {
      ...opts,
      headers: { ...this.headers, ...(opts.headers || {}) }
    });

    if (res.status === 401) {
      this.token = null;
      window.dispatchEvent(new CustomEvent('api:unauthorized'));
      throw new Error('Unauthorized');
    }

    return res;
  },

  async get(url) {
    const res = await this._fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async post(url, data) {
    const res = await this._fetch(url, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
  },

  async del(url) {
    const res = await this._fetch(url, { method: 'DELETE' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async download(url, filename) {
    const res = await this._fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  },

  async login(password) {
    const token = btoa('admin:' + password);
    const res = await fetch('/api/stats', {
      headers: { 'Authorization': 'Basic ' + token }
    });
    if (res.ok) {
      this.token = token;
      return true;
    }
    return false;
  }
};

export default API;
