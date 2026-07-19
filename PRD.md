# PRD: Telegram Anonymous Random Chat Bot

## 1. Ringkasan Produk

Bot Telegram yang menghubungkan dua pengguna secara acak untuk mengobrol tanpa
mengetahui identitas satu sama lain (mirip Omegle, tapi di dalam Telegram).
Repo starter sudah ada dan **berjalan** dengan fitur inti (pairing acak +
relay pesan anonim, in-memory storage). PRD ini mendefinisikan sisa pekerjaan
untuk membawa bot dari prototipe ke versi yang siap dipakai lebih banyak
pengguna secara aman.

## 2. Status Saat Ini (Baseline — sudah selesai)

Ada di `index.js`, stack: Node.js + Telegraf, storage: in-memory.

Fitur yang **sudah berfungsi**, jangan ditulis ulang dari nol kecuali memang
perlu di-refactor untuk mendukung fitur baru:
- `/start` — pesan selamat datang
- `/search` — masuk antrian, auto-pairing kalau ada partner tersedia
- `/next` — putus chat aktif, langsung cari partner baru
- `/stop` — putus chat / batal dari antrian
- Relay pesan pakai `ctx.telegram.copyMessage` (bukan forward) supaya identitas
  asli tidak bocor — sudah mendukung semua tipe pesan (teks, foto, stiker,
  voice, video, dokumen, dll)
- Struktur data: `queue` (array), `partners` (Map dua arah `chatId -> chatId`),
  `inQueueSet` (Set)

**Keterbatasan yang harus diperbaiki** (lihat backlog di bawah):
- Semua state hilang saat proses restart (in-memory)
- Tidak ada rate limiting → rawan spam
- Tidak ada sistem report/block → rawan penyalahgunaan
- Tidak ada moderasi konten otomatis
- Tidak ada logging/monitoring produksi
- Belum di-deploy (masih dijalankan lokal via polling)

## 3. Tujuan & Non-Tujuan

### Tujuan
1. Bot bisa dipakai banyak user bersamaan tanpa kehilangan data pairing saat restart.
2. Ada mekanisme dasar untuk mencegah penyalahgunaan (spam, konten ilegal, harassment).
3. Bot bisa di-deploy ke server produksi dengan webhook, bukan polling.
4. Kode tetap simpel dan mudah dirawat — hindari over-engineering untuk skala kecil-menengah (ratusan–ribuan user aktif).

### Non-Tujuan (di luar scope versi ini)
- Fitur matching berbasis minat/lokasi/gender (bisa jadi fase berikutnya)
- Voice/video call langsung di dalam bot
- Aplikasi web/dashboard admin dengan UI (cukup command admin via Telegram dulu)
- Monetisasi (ads, premium tier)

## 4. User Stories

| # | Sebagai... | Saya ingin... | Supaya... |
|---|---|---|---|
| 1 | User baru | Langsung paham cara pakai bot dari `/start` | Tidak bingung harus ngapain |
| 2 | User | Dicarikan partner secepat mungkin | Tidak menunggu lama |
| 3 | User | Bisa keluar/ganti partner kapan saja | Merasa punya kontrol |
| 4 | User | Melaporkan partner yang melanggar (`/report`) | Merasa aman dari harassment/konten ilegal |
| 5 | User | Tidak di-spam pesan bertubi-tubi | Pengalaman chat tetap nyaman |
| 6 | Admin/owner bot | Melihat statistik dasar (jumlah user aktif, antrian, dsb) | Bisa memantau kesehatan bot |
| 7 | Admin/owner bot | Data pairing tidak hilang saat bot restart/deploy ulang | Tidak mengganggu user yang sedang chat |
| 8 | Owner bot | Bot tetap jalan meski server restart (deploy production-grade) | Uptime tinggi |

## 5. Functional Requirements (Backlog untuk Dikerjakan)

Urutkan pengerjaan sesuai prioritas P0 → P2. Setiap item harus dikerjakan
sebagai unit kerja terpisah (branch/commit terpisah), dan tidak boleh merusak
fitur baseline yang sudah jalan.

### P0 — Wajib sebelum bot dipakai publik

**5.1 Persistent Storage**
- Ganti in-memory `queue`, `partners`, `inQueueSet` dengan database.
- Rekomendasi: **SQLite** (via `better-sqlite3` atau `sequelize`/`prisma`)
  untuk skala kecil-menengah — tidak butuh server DB terpisah.
- Skema minimal:
  - Tabel `users`: `chat_id` (PK), `status` (`idle`/`queued`/`chatting`),
    `partner_id` (nullable), `created_at`, `is_banned` (bool)
  - Tabel `reports`: `id`, `reporter_id`, `reported_id`, `reason`, `created_at`
- Semua fungsi `pairUsers`, `unpairUser`, `removeFromQueue` di-refactor untuk
  baca/tulis dari DB, bukan variabel in-memory.
- Tambahkan migration script sederhana yang jalan otomatis saat `npm start`
  pertama kali (buat tabel kalau belum ada).

**5.2 Rate Limiting**
- Batasi jumlah pesan per user per satuan waktu (contoh: maksimal 20
  pesan/menit) untuk cegah spam ke partner.
- Batasi juga frekuensi `/search` `/next` (contoh: cooldown 2 detik) untuk
  cegah bot dipakai buat flood matching request.
- Kalau limit terlampaui, balas dengan pesan singkat, jangan silent-drop.

**5.3 Report & Block System**
- Command `/report [alasan opsional]` — melapor partner yang sedang aktif
  chat dengan user tsb. Simpan ke tabel `reports`.
- Command admin `/ban <chat_id>` dan `/unban <chat_id>` (hanya bisa
  dijalankan oleh `ADMIN_CHAT_ID` yang di-set di `.env`).
- User yang di-ban tidak bisa `/search` — beri pesan penjelasan singkat.
- (Opsional tapi disarankan) Auto-flag: kalau satu user dilaporkan oleh ≥3
  partner berbeda dalam 24 jam, auto-ban sementara sambil menunggu review admin.

### P1 — Penting untuk kualitas & keamanan operasional

**5.4 Basic Content Moderation**
- Cek pesan teks terhadap daftar kata terlarang (blocklist sederhana di file
  config, bukan perlu ML dulu). Kalau kena filter, pesan tidak diteruskan +
  user diberi peringatan.
- Untuk media (foto/video), moderasi otomatis dengan model vision bisa
  menyusul di fase berikutnya — cukup catat di README sebagai known
  limitation untuk versi ini.

**5.5 Admin Stats Command**
- Command `/stats` (admin only): jumlah user online, jumlah pasangan aktif,
  jumlah user dalam antrian, jumlah report 24 jam terakhir.

**5.6 Logging**
- Ganti `console.log`/`console.error` polos dengan logger terstruktur
  (`pino` atau `winston`), log ke file + stdout.
- Jangan log isi pesan user (privasi) — cukup log metadata (chat_id,
  event type, timestamp).

### P2 — Nice to have, kerjakan kalau P0/P1 sudah beres

**5.7 Deploy Production dengan Webhook**
- Ganti `bot.launch()` polling jadi webhook mode (`bot.launch({ webhook: {...} })`)
  untuk deploy di platform seperti Railway/Render/VPS + Nginx + HTTPS.
- Tambahkan `Dockerfile` sederhana untuk memudahkan deploy.

**5.8 Matching Filter Dasar**
- User bisa set preferensi bahasa (`/lang id` / `/lang en`) sebelum `/search`,
  dan matching mengutamakan partner dengan preferensi bahasa sama (fallback
  ke siapa saja kalau tidak ada yang cocok dalam waktu tertentu).

## 6. Technical Constraints

- Bahasa: **Node.js** (sudah ditentukan, jangan diganti ke bahasa lain).
- Library bot: **Telegraf** (`^4.16.3`), jangan ganti ke library lain.
- Storage: SQLite untuk versi ini (bukan PostgreSQL/MongoDB) — kecuali ada
  alasan kuat skala jauh lebih besar dari target (ribuan concurrent).
- Environment variables via `.env` (`dotenv`), termasuk minimal:
  - `BOT_TOKEN` (wajib)
  - `ADMIN_CHAT_ID` (wajib untuk fitur admin)
  - `DATABASE_PATH` (opsional, default `./data/bot.db`)
- Jangan pernah expose data pribadi (username, nama, foto profil) user ke
  partner chat-nya — ini adalah aturan keras, harus dijaga di semua fitur baru.
- Semua perubahan tidak boleh menghapus fungsi `copyMessage` sebagai metode
  relay (jangan diganti `forwardMessage`, karena itu akan membocorkan identitas).

## 7. Struktur File yang Diharapkan Setelah Selesai

```
anon-bot/
├── index.js              # entry point, setup bot + command handlers
├── src/
│   ├── db.js              # koneksi & query helper SQLite
│   ├── handlers/
│   │   ├── start.js
│   │   ├── search.js
│   │   ├── stop.js
│   │   ├── next.js
│   │   ├── report.js
│   │   └── admin.js
│   ├── middleware/
│   │   └── rateLimit.js
│   ├── moderation/
│   │   └── wordFilter.js
│   └── logger.js
├── data/                  # folder DB SQLite (gitignore isinya)
├── .env.example
├── package.json
├── README.md
├── PRD.md                 # dokumen ini
└── Dockerfile              # (P2)
```

Boleh disesuaikan asal alasan perubahannya masuk akal dan didokumentasikan
di README.

## 8. Acceptance Criteria (per rilis)

Rilis dianggap selesai kalau:
1. Semua command baseline (`/start /search /stop /next`) tetap berfungsi
   seperti sebelumnya, tervalidasi manual.
2. Restart proses bot (`Ctrl+C` lalu `npm start` lagi) **tidak** membuat user
   yang sedang di antrian/chat kehilangan status mereka (setelah P0.5.1 selesai).
3. Spam >20 pesan/menit dari satu user terblokir tanpa meng-crash bot
   (setelah P0.5.2 selesai).
4. `/report` tersimpan ke DB dan bisa dilihat lewat query manual
   (setelah P0.5.3 selesai).
5. Tidak ada satu pun path kode yang memanggil `forwardMessage` untuk relay
   pesan antar user.
6. README diperbarui setiap kali ada command atau env var baru ditambahkan.

## 9. Risiko & Catatan Keamanan

- **Penyalahgunaan untuk konten ilegal** (mis. CSAM, konten eksploitatif):
  ini risiko nyata untuk semua bot anonymous chat. P0.5.3 (report/ban) dan
  P1.5.4 (moderasi) adalah mitigasi minimum, bukan solusi lengkap. Sebelum
  bot dibuka ke publik luas, pertimbangkan integrasi API moderasi gambar
  pihak ketiga dan proses penanganan laporan yang jelas (siapa yang review,
  SLA, eskalasi ke pihak berwenang bila perlu).
- **Rate limit & abuse** harus di-deploy sebelum bot dibagikan di grup besar,
  bukan sesudahnya.
- **Data privasi**: jangan simpan isi pesan di DB kecuali benar-benar perlu
  untuk fitur report (dan itu pun harus ada kebijakan retensi/penghapusan
  data yang jelas).
