# AGENTS.md — Konteks Resmi & Aturan Kerja untuk AI Coding Agent (Updated: Patch 2.0 - Saga II Active)

File ini merupakan sumber kebenaran tertinggi (Single Source of Truth) bagi setiap agent AI (Antigravity, Codex, Claude, ChatGPT, Cursor, atau sejenisnya) yang melanjut, merefaktor, atau menambah fitur pada repositori **Anon-Chat-Game**. 
**WAKTU BACA & PATUHI KETENTUAN DI BAWAH INI SEBELUM MEMODIFIKASI SATU BARIS PUN KODE!**

---

## 1. 📖 Urutan Baca & Pemahaman Konten
1. `AGENTS.md` — Aturan arsitektur teknis, batasan VPS, dan hukum keamanan (file ini).
2. `HANDOFF.md` — Ringkasan status terkini, fitur aktif, dan panduan peralihan agent AI.
3. `PRD.md` — Spesifikasi produk live-service berseries (Saga I & Saga II Patch 2.0 aktif) dan filosofi "Anti-Boredom".
4. `TASKS.md` — Daftar pencapaian Saga I & II yang telah purna lunas dan roadmap berikutnya.
5. `PANDUAN_SETUP_VPS.md` — Aturan deploy ke lingkungan Linux production (Git Pull / PM2 / SSH).

---

## 2. 🏰 Arsitektur Wajib: Modular Patch System (Content Delivery System)
Sistem cerita, dungeon, dan eksplorasi MENGGUNAKAN ARSITEKTUR MODULAR.
- **JANGAN PERNAH MENUMPUK KODE BARU SECARA MANUAL** ke file `data/rpg_regions.json`, `data/rpg_campaign.json`, atau `data/rpg_dungeons.json`. File-file tersebut adalah **FILE HASIL AUTO-GENERATE** dari aggregator.
- **CARA MENAMBAH KONTEN BARU (Saga II / Patch 2.0+):**
  1. Buat atau edit file patch per-saga di direktori modular: `data/patches/saga_v2/patch_X_Y.json`.
  2. Gunakan status `"published": false` jika patch masih dalam tahap draf internal, dan ubah ke `"published": true` bila siap dirilis.
  3. Mesin `data/patch_loader.js` akan otomatis menyatukan file-file modular tersebut setiap kali server atau unit test diaktifkan.
  4. Untuk memicu build penggabungan manual, jalankan perintah: `npm run build:patches`.

---

## 3. ⚠️ Aturan Kritis Sistem & Stabilitas VPS (NON-NEGOTIABLE)
- **Express 5 Wildcard Routing Bug Prevention**: Dashboard web menggunakan Express versi 5. Dalam Express 5, rute penangkap fallback/wildcard **WAJIB MENULISKAN** syntax `/{*path}` (contoh di `dashboard.js`: `app.get('/{*path}', ...)`). **JANGAN PERNAH KEMBALIKAN KODE KE `app.get('*')`** atau sejenisnya, karena akan menyebabkan loop rekursif fatal yang meledakkan CPU VPS hingga 100%!
- **Metode Relay Pesan Anonymous Chat**: Harus dan senantiasa menggunakan `ctx.telegram.copyMessage` untuk merelay chat acak antar pengguna. **DILARANG KERAS** memakai `forwardMessage`, karena forward melanggar privasi (membuka username dan foto profil pengirim asal).
- **Stack Teknologi Tetap**: Jangan meretas atau mengubah fondasi arsitektur (Node.js CommonJS + Telegraf + SQLite `better-sqlite3`). Hindari mencampur syntax ESM (`import / export`) ke dalam codebase CommonJS (`require / module.exports`).

---

## 4. 🎮 Filosofi Game Design & Interface (Anti-Boredom & Clean UI)
- **Hukum Anti-Boredom (Gameplay Taktis & Dinamis)**: Setiap penambahan level atau patch tidak boleh berujung pada grinding combat yang berulang dan membosankan. Pastikan pengintegrasian dengan **7 Profesi Kuno (`/gather`, `/mine`, `/fish`)**, **Perdagangan Konsinyasi (`/market`, `/trade`)**, dan **Synergi Aliansi Guild & Co-Op (`/coop`)** agar dinamika bermain bervariasi (Monotone Combat Ratio wajib <15%).
- **Input Angka 1-Based**: Semua daftar item, skill, dungeon, equipment, dan keputusan event harus menampilkan nomor urut (1-based index: 1, 2, 3...) yang gampang diketrik di ponsel pintar Telegram, tanpa mewajibkan input string ID internal.
- **Pengecekan Kerapihan /profile & /guide**: Perintah `/profile` harus tetap ramah dibaca di layar Telegram tanpa melebihi batas karakter pesan, menampilkan rekor dan level perlengkapan dengan ringkas namun bergengsi.

---

## 5. 🧪 Standar Pengujian & Deployment SSH
Setiap selesai mengonstruksi pemutakhiran, agen AI WAJIB mengeksekusi uji coba otomatisasi di lingkungan Terminal dan sinkronisasi server VPS:
```bash
cmd.exe /c "npm run build:patches && npm test && npm run simulate:saga"
```
*Pastikan seluruh 7+ unit test lulus 100% (All Pass), simulasi mencontohkan gameplay dinamis, dan deploy ke VPS dilakukan sejuk tanpa crash!*