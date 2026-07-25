# 🤝 HANDOFF.md — Panduan & Status Peralihan AI Agent (Codex / Claude / ChatGPT / Cursor)

Dokumen ini dibuat khusus untuk mempermudah AI Agent baru (**Codex**, **Claude**, **ChatGPT**, **Cursor**, dll.) dalam memahami seluruh konteks, arsitektur, status terkini, dan aturan proyek **Anon-Chat-Game** secara instan tanpa ada informasi yang terlewat.

---

## 📌 Status Terkini Proyek (Live State)
- **Status Bot**: Aktif & Deployed di Server VPS (`103.103.22.251`).
- **PM2 Processes**:
  - `anon-chat-bot` (ID 12) — Bot Telegram Anonymous Chat & RPG Engine.
  - `anon-dashboard` (ID 16) — Web Admin Dashboard Express.js.
- **Progress Cerita (Saga Status)**:
  - **Saga I (Patch 1.0, 1.1, 1.2)**: 100% Selesai & Aktif.
  - **Saga II (Patch 2.0, 2.1, 2.2, 2.3 - The Astral Horizon Grand Finale)**: 100% Selesai & Aktif (`patch_2_0.json` s/d `patch_2_3.json`).
  - **Campaign Quests & Dungeons**: Chapter 1 s/d Chapter 7 (Level Cap 60+) serta Dungeon megah 20-Ruangan *Istana Tahta Kaisar Kosmik* (`emperor_throne_citadel`) dengan bos *Kaisar Kosmik Xylarion* (HP: 25.000) telah aktif!
  - **Teaser Saga III**: Alur cerita telah terbuka untuk implementasi berikutnya pada *Saga III: Underworld of the Forgotten Realm (Patch 3.0)*.

---

## 🔑 Aturan Emas Arsitektur & Kuis Stabilitas (Wajib Dipatuhi)

1. **Modular Patch System (DILARANG Edit JSON Aggregated Manual)**:
   - Jangan pernah mengedit langsung `data/rpg_campaign.json`, `data/rpg_regions.json`, atau `data/rpg_dungeons.json`.
   - Selalu edit/tambah file patch di `data/patches/saga_vX/patch_X_Y.json` lalu jalankan perintah:
     ```bash
     cmd /c npm run build:patches
     ```

2. **Express 5 Fallback Routing (Mencegah CPU Spikes 100% di VPS)**:
   - Dashboard menggunakan Express v5.
   - Rute wildcard **WAJIB** ditulis: `app.get('/{*path}', ...)` di `dashboard.js`.
   - **DILARANG** memakai `app.get('*')`.

3. **Anonymous Chat Relay**:
   - Selalu gunakan `ctx.telegram.copyMessage(...)` untuk merelay pesan anonim.
   - **DILARANG** memakai `forwardMessage` untuk menjaga privasi pengguna.

4. **Stack & Syntax**:
   - Node.js CommonJS (`require` / `module.exports`). Jangan mencampur ESM (`import`/`export`).
   - Tampilan Telegram menggunakan 1-based index (1, 2, 3...) untuk kenyamanan pengguna HP.

---

## 🧪 Perintah Pengujian & Deployment

Sebelum dan sesudah melakukan perubahan kode, eksekusi perintah berikut di Terminal:

```bash
# 1. Jalankan aggregator & unit test
cmd /c "npm run build:patches && npm test"

# 2. Deploy otomatis ke server VPS via SSH
powershell -Command "ssh -i '$env:USERPROFILE\.ssh\Ryukomikssh.pem' -o StrictHostKeyChecking=no ryukomik@103.103.22.251 'cd /home/ryukomik/Anon-Chat-Game && git pull origin main && npm run build:patches && pm2 restart anon-chat-bot && pm2 restart anon-dashboard'"
```

---

## 📂 Peta File Penting
- `AGENTS.md` — Single Source of Truth aturan arsitektur.
- `index.js` — Entry point utama Telegram Bot & handler perintah.
- `dashboard.js` — Server Express.js Web Admin Dashboard.
- `src/rpg/` — Modul game engine RPG (`profile.js`, `guide.js`, `world.js`, `campaign.js`, `db_rpg.js`).
- `data/patches/` — File patch modular cerita per-saga.
