# Anonymous Chat Bot (Telegram)

Bot Telegram untuk obrolan acak tanpa mengungkap identitas (mirip Omegle).
Dibangun dengan **Node.js, Telegraf, dan SQLite**.

## Fitur Utama

- Pencarian partner secara acak (`/search`)
- Penyimpanan persisten (menggunakan `better-sqlite3`), sehingga data antrian tidak hilang saat restart
- Fitur limitasi spam pesan & proteksi flooding perintah
- Moderasi kata dasar
- Preferensi Bahasa (`/lang id` atau `/lang en`)
- Sistem *Report* dan *Ban* untuk menangani penyalahgunaan
- Dunia RPG persisten dengan region, campaign, dan eksplorasi (`/rpg`, `/world`, `/explore`)
- Skill tree dan loadout per class (`/skill`, `/build`)
- Loadout skill aktif digunakan dalam combat dungeon dan duel, dengan cooldown per skill
- Dungeon solo multi-room dengan jalur bercabang dan checkpoint persisten (`/adventure`)
- Campaign Aldenmoor berbasis objective dengan event idempotent (`/campaign`)
- Tujuh profession dengan gathering, salvage, dan refinement

## Keterbatasan Saat Ini (Known Limitations)

- Moderasi media (foto/video) belum ada di versi ini.

## Cara Pakai

1. **Buat Bot & Ambil Token**
   Bicara ke [@BotFather](https://t.me/BotFather) dan buat bot baru untuk mendapatkan Token (misalnya: `123456:ABC-DEF...`).

2. **Install Dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment**
   Salin `.env.example` ke `.env`:
   ```bash
   cp .env.example .env
   ```
   Isi file `.env`:
   - `BOT_TOKEN`: Token dari BotFather.
   - `ADMIN_CHAT_ID`: Chat ID Telegram Anda (untuk mengakses fitur `/ban` & `/stats`).
   - `DATABASE_PATH`: (Opsional) path ke database, default `./data/bot.db`.
   - `WEBHOOK_DOMAIN`: (Opsional) jika ingin menggunakan mode Webhook, isi dengan URL web service Anda.

4. **Jalankan Bot (Lokal)**
   ```bash
   npm start
   ```

## Panduan Setup & Deploy ke VPS (Production)

Untuk menjalankan bot secara terus-menerus (24/7) di server VPS (Ubuntu/Debian) dengan **PM2** agar otomatis restart dan tahan banting, silakan baca panduan lengkap kami:

👉 **[Baca Panduan Lengkap Setup & Deployment ke VPS (PANDUAN_SETUP_VPS.md)](PANDUAN_SETUP_VPS.md)**

Ringkasan singkat deploy menggunakan PM2 di VPS:
```bash
# 1. Clone & install
git clone https://github.com/bagusdanur/Anon-Chat-Game.git
cd Anon-Chat-Game && npm install

# 2. Setup environment (.env)
cp .env.example .env && nano .env

# 3. Install PM2 global & jalankan bot di background
sudo npm install -g pm2
pm2 start index.js --name "anon-chat-bot"
pm2 save && pm2 startup
```

## Perintah (User)

| Command           | Fungsi                                             |
|-------------------|----------------------------------------------------|
| `/start`          | Pesan selamat datang & bantuan                     |
| `/search`         | Mulai cari partner                                 |
| `/rpg`            | Membuka menu dunia dan campaign RPG                 |
| `/world`          | Melihat region dan progress campaign RPG            |
| `/explore`        | Menjelajahi region aktif                             |
| `/travel [region]`| Berpindah ke region yang sudah terbuka               |
| `/skill`          | Melihat, mempelajari, dan memasang skill             |
| `/build`          | Melihat skill tree dan loadout aktif                 |
| `/adventure`      | Memulai atau melanjutkan dungeon solo panjang        |
| `/dungeon solo`   | Alias dungeon solo dengan checkpoint persisten       |
| `/campaign`       | Melihat chapter dan objective campaign               |
| `/profession`     | Melihat level dan mastery seluruh profession          |
| `/gather herb`    | Mengumpulkan tanaman dan Herbalism XP                 |
| `/salvage [item]` | Membongkar equipment menjadi material                 |
| `/refine [ore]`   | Memurnikan lima material menjadi tier berikutnya      |
| `/next`           | Putus chat dan langsung cari partner baru          |
| `/stop`           | Mengakhiri chat atau batal antri                   |
| `/lang [id/en]`   | Memilih preferensi bahasa (prioritas matching)     |
| `/report [alasan]`| Melaporkan partner yang sedang di-chat             |

## Perintah (Admin)

Perintah ini hanya bisa dijalankan oleh pengguna dengan ID yang sesuai dengan `ADMIN_CHAT_ID`.

| Command          | Fungsi                                          |
|------------------|-------------------------------------------------|
| `/stats`         | Melihat statistik (online, queued, paired, dll) |
| `/ban <chatId>`  | Memblokir pengguna                              |
| `/unban <chatId>`| Membuka blokir pengguna                         |
