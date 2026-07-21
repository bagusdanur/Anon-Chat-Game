# TASKS — Checklist Eksekusi

Referensi lengkap ada di `PRD.md`. File ini adalah breakdown tugas siap
kerja, urut dari prioritas tertinggi. Centang tiap sub-task setelah selesai
dan teruji manual. Jangan lompat ke task berikutnya kalau task sebelumnya
belum lulus acceptance criteria di PRD §8.

## P0.1 — Persistent Storage (SQLite)
- [x] Tambah dependency `better-sqlite3`
- [x] Buat `src/db.js`: inisialisasi koneksi + auto-create tabel `users` dan `reports` kalau belum ada
- [x] Buat folder `data/` + tambahkan ke `.gitignore`
- [x] Refactor `pairUsers`, `unpairUser`, `removeFromQueue`, cek status queue/pairing agar baca/tulis dari DB
- [x] Tambah `DATABASE_PATH` ke `.env.example`
- [x] Test manual: jalankan bot, `/search` di 2 akun sampai paired, kill process (`Ctrl+C`), `npm start` lagi, pastikan status masih tersimpan (chat mungkin perlu re-notify user, tapi data tidak hilang/corrupt)

## P0.2 — Rate Limiting
- [x] Buat `src/middleware/rateLimit.js`
- [x] Terapkan limit pesan (default 20/menit, bisa di-config via `.env`)
- [x] Terapkan cooldown untuk `/search` dan `/next` (default 2 detik)
- [x] Test manual: kirim >20 pesan cepat, pastikan bot tidak crash dan user dapat pesan peringatan, bukan silent drop

## P0.3 — Report & Block System
- [x] Tambah command `/report [alasan]` → simpan ke tabel `reports`
- [x] Tambah command admin `/ban <chat_id>` dan `/unban <chat_id>`, dibatasi hanya untuk `ADMIN_CHAT_ID`
- [x] User dengan `is_banned = true` diblokir dari `/search` dengan pesan yang jelas
- [x] (Opsional) Auto-flag setelah ≥3 report berbeda dalam 24 jam
- [x] Tambah `ADMIN_CHAT_ID` ke `.env.example`
- [x] Test manual: lapor user via `/report`, cek row masuk ke DB; test `/ban` dari akun non-admin harus ditolak

## P1.1 — Basic Content Moderation
- [x] Buat `src/moderation/wordFilter.js` dengan daftar kata terlarang (config file terpisah, mudah di-edit tanpa ubah kode)
- [x] Terapkan filter sebelum pesan di-relay; kalau kena filter, jangan diteruskan + beri peringatan ke pengirim
- [x] Dokumentasikan di README bahwa moderasi media (foto/video) belum ada di versi ini (known limitation)

## P1.2 — Admin Stats
- [x] Command `/stats` (admin only): total user, user online, pasangan aktif, jumlah di antrian, jumlah report 24 jam terakhir

## P1.3 — Logging
- [x] Ganti seluruh `console.log`/`console.error` dengan logger terstruktur (`pino`)
- [x] Pastikan isi pesan user TIDAK pernah masuk log — hanya metadata (chat_id, event, timestamp)

## P2.1 — Deploy Production
- [x] Ubah `bot.launch()` ke mode webhook
- [x] Buat `Dockerfile` (Telah Dibatalkan Sesuai Permintaan)
- [x] Update README dengan instruksi deploy (target: Railway atau VPS + Nginx)

## P2.2 — Matching Filter Bahasa
- [x] Command `/lang id` / `/lang en`, simpan preferensi ke tabel `users`
- [x] Prioritaskan pairing dengan preferensi bahasa sama, fallback ke siapa saja setelah timeout tertentu

## P3.1 — Admin Web Dashboard (Ekspansi)
- [ ] Install library tambahan (`express`, `ejs`, `express-session` untuk autentikasi)
- [ ] Buat file `src/dashboard/server.js` untuk setup server Express
- [ ] Buat rute login (`/login`) dengan hardcoded kredensial dari `.env` (`DASHBOARD_USER`, `DASHBOARD_PASS`)
- [ ] Buat halaman utama (`/`) untuk menampilkan statistik (total user, antrian, chat aktif)
- [ ] Buat halaman moderasi (`/reports`) untuk melihat daftar user yang dilaporkan dari database SQLite
- [ ] Tambahkan tombol/API endpoint di dashboard untuk melakukan Ban/Unban via UI
- [ ] Buat halaman broadcast (`/broadcast`) untuk kirim pesan massal
- [ ] Pastikan akses dashboard diamankan middleware autentikasi dan tidak ada data privasi (chat) terekspos

## Definition of Done (semua task)
- [x] Command baseline (`/start /search /stop /next`) tetap berjalan normal
- [x] `README.md` diperbarui kalau ada command/env var baru
- [x] Tidak ada penggunaan `forwardMessage` di manapun untuk relay pesan (harus `copyMessage`)
- [x] Tidak ada data pribadi user (username/nama) yang dikirim ke partner chat-nya
