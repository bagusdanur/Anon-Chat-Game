# AGENTS.md — Konteks untuk AI Coding Agent

File ini khusus untuk agent (Antigravity atau sejenisnya) yang mengerjakan
repo ini. Baca file ini SEBELUM mulai edit kode.

## Baca urutan ini dulu
1. `PRD.md` — requirement lengkap & alasan di baliknya
2. `TASKS.md` — checklist eksekusi, kerjakan sesuai urutan prioritas
3. `README.md` — cara install & run yang harus tetap akurat setelah perubahan

## Prinsip Kerja
- **Jangan big-bang rewrite.** `index.js` saat ini sudah jalan dan sudah
  diverifikasi (`npm install` sukses, syntax valid). Refactor bertahap per
  task di `TASKS.md`, bukan menulis ulang semuanya sekaligus.
- **Setiap task = commit/perubahan terpisah** yang bisa dites sendiri sebelum
  lanjut ke task berikutnya.
- **Jangan ganti stack.** Tetap Node.js + Telegraf + SQLite (`better-sqlite3`).
  Jangan migrasi ke Python, Deno, Postgres, Mongo, dll kecuali diminta eksplisit.
- **Jangan ganti metode relay pesan.** Harus tetap `ctx.telegram.copyMessage`,
  bukan `forwardMessage` — ini keputusan sengaja untuk menjaga anonimitas
  (forwardMessage menampilkan nama/username pengirim asli, copyMessage tidak).
- **Sinkronkan command.** Setiap menambah, menghapus, atau mengubah command bot,
  wajib pada perubahan yang sama memperbarui daftar `botCommands` Telegram,
  panduan `/helprpg`, dan tabel command di `README.md` bila relevan.
- **Jaga `/profile` sebagai pusat ringkasan pemain.** Saat menambah sistem
  player-facing yang memiliki status/progres penting, tampilkan ringkasan
  singkatnya di `/profile` tanpa membuat pesan melewati batas Telegram.
- **Gunakan nomor untuk input pemain.** Daftar item, gear, skill, anggota,
  quest, region, listing, trade, dan pilihan lain yang terlihat pemain harus
  menampilkan nomor 1-based dan command utamanya menerima nomor tersebut.
  ID internal boleh tetap didukung untuk kompatibilitas, tetapi jangan
  diwajibkan atau ditampilkan sebagai instruksi utama.
- **Berikan arah singkat.** Menu dan hasil aktivitas player-facing harus
  menjelaskan status, tujuan atau langkah berikutnya, dan satu tips relevan
  secara ringkas. Utamakan arahan kontekstual; jangan memenuhi pesan dengan
  daftar command panjang.

## Aturan Keamanan & Privasi (non-negotiable)
- Jangan pernah kirim `username`, `first_name`, `last_name`, atau foto profil
  user ke partner chat-nya, dalam kondisi apapun, di fitur manapun.
- Jangan log isi pesan user ke console/file. Log hanya metadata (chat_id,
  jenis event, timestamp).
- Data report (`/report`) boleh menyimpan alasan singkat, tapi jangan simpan
  isi pesan lengkap kecuali task eksplisit memintanya.

## Testing Manual Minimum Sebelum Menandai Task Selesai
Untuk setiap perubahan yang menyentuh alur pairing/relay:
1. Jalankan bot lokal (`npm start`)
2. Simulasikan 2 user (2 akun Telegram atau 2 device) → `/search` di keduanya
   → pastikan ke-pair dan pesan ter-relay dua arah
3. Uji `/next` dan `/stop` → pastikan state ter-update dengan benar di kedua sisi
4. Untuk fitur baru (rate limit, report, ban) → uji jalur gagal juga, bukan
   cuma jalur sukses (contoh: kirim spam untuk uji rate limit, coba `/ban`
   dari akun non-admin untuk uji otorisasi)

## Style Kode
- CommonJS (`require`), konsisten dengan `index.js` yang sudah ada — jangan
  campur dengan ESM (`import`) kecuali seluruh project dimigrasikan sekaligus
  dengan alasan jelas.
- Nama file & folder: `camelCase.js` untuk file, `kebab-case` untuk folder kalau ada.
- Komentar boleh Bahasa Indonesia atau Inggris, konsisten dengan gaya yang
  sudah ada di file terkait (repo saat ini pakai komentar Bahasa Indonesia).

## Kalau Ragu
Kalau requirement di PRD ambigu atau ada keputusan desain yang tidak
tercakup, pilih opsi paling sederhana yang memenuhi acceptance criteria,
dan catat asumsi yang diambil di README bagian "Catatan Implementasi" —
jangan berhenti menunggu klarifikasi kecuali benar-benar blocking (misal:
kredensial yang tidak tersedia).
