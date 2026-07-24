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
- Tracker progres dinamis untuk posisi world/campaign, objective aktif, tindakan sekarang, checkpoint, dan unlock berikutnya (`/guide`)
- Skill tree dan loadout per class (`/skill`, `/build`)
- Loadout skill aktif digunakan dalam combat dungeon dan duel, dengan cooldown per skill
- Dungeon solo/duo multi-room dengan jalur bercabang dan checkpoint persisten (`/dungeon`)
- Campaign Aldenmoor berbasis objective dengan event idempotent (`/campaign`)
- Tujuh profession dengan gathering, salvage, dan refinement
- Controlled marketplace dengan escrow, pajak, expiry, dan audit ledger
- Preseason, leaderboard anonim, Endless Tower, achievement, dan collection
- Party persisten dan guild dengan alias karakter anonim
- Pusat anonymous co-op (`/coop`) untuk party, dungeon duo, bounty, campaign, raid, dan duel
- `/dungeon` membuka dungeon panjang baru; raid boss klasik dipindahkan ke `/dungeon raid`
- Dungeon duo memerlukan persetujuan partner, menyimpan undangan 10 menit, dan mengirim menu/nomor giliran ke kedua pemain
- World boss asynchronous harian dan weekly party raid dengan kontribusi persisten
- Guild quest mingguan serta role owner/officer/member dengan audit perubahan
- Duo bounty harian dan co-op campaign dengan progress karakter independen
- Equipment instance dengan quality, item power, affix, binding, dan socket/gem
- Upgrade hingga +15, reforge affix, dan bonus equipment set
- Bonus equipment v2 aktif pada dungeon, duel, tower, bounty, world boss, dan raid
- Direct trade dua tahap dengan snapshot, expiry, settlement atomik, pajak, dan ledger
- Dungeon panjang duo dengan checkpoint bersama, optimistic version, dan reward individual
- Simulasi ekonomi deterministik untuk ribuan pemain virtual (`npm run simulate:economy`)
- Simulasi balance combat lintas class dan level (`npm run simulate:combat`)
- Dry-run migrasi pada backup konsisten SQLite (`npm run migration:dry-run -- [source] [target]`)

## Keterbatasan Saat Ini (Known Limitations)

- Moderasi media (foto/video) belum ada di versi ini.

## Catatan Balance RPG

- Hunt memakai scaling monster per level; gear pemain tidak ikut menaikkan stat musuh.
- Hunt dari HP penuh ditargetkan 3–8 turn dengan konsumsi rata-rata 10–45% HP.
- Reruntuhan Goblin dapat dicoba sejak awal, tetapi ekspedisi penuh solo direkomendasikan mulai level 7; level lebih rendah diarahkan ke duo.
- Weekly raid duo disetel agar masih dapat dituntaskan oleh dua karakter pada level minimum bila seluruh attempt digunakan.
- Reruntuhan Goblin memiliki lima lapis combat; mode duo memakai giliran bergantian dan energi Combo bersama.

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
| `/guide`          | Menampilkan alur progres dan langkah berikutnya     |
| `/profile`        | Ringkasan alias, progres, sosial, build, dan status |
| `/world`          | Melihat region dan progress campaign RPG            |
| `/explore`        | Menjelajahi region aktif                             |
| `/travel [nomor]` | Berpindah ke region bernomor yang sudah terbuka      |
| `/skill`          | Melihat, mempelajari, dan memasang skill             |
| `/build`          | Melihat skill tree dan loadout aktif                 |
| `/dungeon`      | Panduan dungeon tactical solo/duo                      |
| `/dungeon duo [nomor]` | Dungeon turn-based bersama party                  |
| `/adventure` | Alias kompatibilitas untuk menu dungeon                    |
| `/dungeon solo`   | Alias dungeon solo dengan checkpoint persisten       |
| `/campaign`       | Melihat chapter dan objective campaign               |
| `/profession`     | Melihat level dan mastery seluruh profession          |
| `/gather herb`    | Mengumpulkan tanaman dan Herbalism XP                 |
| `/salvage [nomor]`| Membongkar equipment dari daftar `/inv`               |
| `/refine [nomor]` | Memurnikan lima material dari daftar `/inv`           |
| `/market`         | Marketplace anonim untuk material dan consumable      |
| `/season`         | Melihat seasonal points dan token                     |
| `/rank`           | Leaderboard season dengan alias anonim                |
| `/tower`          | Menantang lantai berikutnya di Endless Tower          |
| `/achievement`    | Melihat achievement karakter                          |
| `/collection`     | Melihat completion koleksi item                       |
| `/alias [nama]`   | Mengatur alias karakter internal                      |
| `/party create`   | Membuat party persisten                               |
| `/party invite`   | Mengundang partner chat ke party                      |
| `/coop`           | Pusat dungeon duo, bounty, campaign, raid, dan duel   |
| `/guild`          | Guild, anggota bernomor, treasury, upgrade, dan shop  |
| `/guild quest`    | Melihat atau mengklaim guild quest mingguan           |
| `/worldboss`      | Melihat, menyerang, dan mengklaim hadiah world boss   |
| `/raid`           | Weekly raid asynchronous untuk party minimal 2 pemain |
| `/bounty`         | Duo bounty harian dengan kontribusi bersama            |
| `/coopcampaign`   | Melihat dan menjalankan campaign bersama party          |
| `/gear`           | Mengelola equipment instance, affix, equip, dan gem      |
| `/trade`          | Trade dua tahap; item dipilih memakai nomor dari `/inv`  |
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
