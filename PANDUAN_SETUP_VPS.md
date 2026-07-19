# 🚀 Panduan Lengkap Setup & Deployment Bot ke VPS (Ubuntu / Debian)

Dokumen ini adalah panduan langkah demi langkah untuk menginstal, mengonfigurasi, dan menjalankan **Anonymous Chat Bot** secara terus-menerus (24/7) di server Virtual Private Server (VPS) menggunakan **Node.js** dan **PM2** (Process Manager).

---

## 📋 Daftar Isi
1. [Persiapan & Spesifikasi Minimum](#1-persiapan--spesifikasi-minimum)
2. [Akses ke VPS & Update Sistem](#2-akses-ke-vps--update-sistem)
3. [Instalasi Node.js & Git](#3-instalasi-nodejs--git)
4. [Clone Repository & Install Dependensi](#4-clone-repository--install-dependensi)
5. [Konfigurasi Environment (.env)](#5-konfigurasi-environment-env)
6. [Menjalankan Bot 24/7 dengan PM2 (Rekomendasi)](#6-menjalankan-bot-247-dengan-pm2-rekomendasi)
7. [Alternatif: Menjalankan Bot dengan Systemd](#7-alternatif-menjalankan-bot-dengan-systemd)
8. [Maintenance, Backup Database, & Update Kode](#8-maintenance-backup-database--update-kode)

---

## 1. Persiapan & Spesifikasi Minimum

Untuk menjalankan bot ini dengan lancar, spesifikasi VPS minimum yang disarankan:
- **OS**: Ubuntu 20.04 LTS / 22.04 LTS / 24.04 LTS (atau Debian 11/12)
- **CPU**: 1 vCPU
- **RAM**: 512 MB – 1 GB
- **Storage**: 10 GB SSD
- **Koneksi**: Memiliki akses internet publik (untuk berkomunikasi dengan API Telegram)

---

## 2. Akses ke VPS & Update Sistem

1. Buka terminal (atau PuTTY di Windows) dan login ke VPS melalui SSH:
   ```bash
   ssh root@IP_ADDRESS_VPS_ANDA
   ```
2. Perbarui daftar paket system dan upgrade paket yang ada:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
3. Install utility dasar yang diperlukan:
   ```bash
   sudo apt install -y curl git nano build-essential
   ```
   *(Catatan: `build-essential` dibutuhkan agar modul C++ seperti `better-sqlite3` dapat dikompilasi dengan sempurna bila prebuilt binary tidak tersedia).*

---

## 3. Instalasi Node.js & Git

Bot ini membutuhkan Node.js (disarankan versi **Node.js 18 LTS** atau **20 LTS**).

1. Install Node.js 20 LTS menggunakan NodeSource:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   ```
2. Verifikasi instalasi Node.js dan npm:
   ```bash
   node -v
   npm -v
   ```
   Pastikan `node -v` menampilkan versi `v18.x` atau `v20.x`.

---

## 4. Clone Repository & Install Dependensi

1. Clone repository GitHub ini ke dalam VPS Anda:
   ```bash
   git clone https://github.com/bagusdanur/Anon-Chat-Game.git
   ```
2. Masuk ke direktori projek:
   ```bash
   cd Anon-Chat-Game
   ```
3. Install seluruh dependensi dari `package.json`:
   ```bash
   npm install
   ```
   Jika muncul peringatan (warning) saat instalasi, itu wajar. Pastikan tidak ada error fatal dan folder `node_modules` telah terbentuk.

---

## 5. Konfigurasi Environment (.env)

Bot membutuhkan token Telegram dari BotFather dan ID Admin untuk mengaktifkan fitur moderasi.

1. Salin file template `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
2. Edit file `.env` menggunakan editor teks `nano`:
   ```bash
   nano .env
   ```
3. Sesuaikan isi konfigurasi dengan data Anda:
   ```env
   BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrSTUvwxYZ
   ADMIN_CHAT_ID=123456789
   DATABASE_PATH=./data/bot.db
   ```
   *Cara menyimpan di `nano`: Tekan `Ctrl + O` -> `Enter` -> Tekan `Ctrl + X` untuk keluar.*

4. Buat folder `data` jika belum ada (agar SQLite dapat membuat file `bot.db`):
   ```bash
   mkdir -p data
   ```

---

## 6. Menjalankan Bot 24/7 dengan PM2 (Rekomendasi)

Agar bot tetap hidup di background, otomatis restart jika terjadi error, dan otomatis menyala kembali setelah VPS direboot, kita menggunakan **PM2**.

### Langkah 1: Install PM2 secara Global
```bash
sudo npm install -g pm2
```

### Langkah 2: Jalankan Bot dengan PM2
Dari dalam direktori `Anon-Chat-Game`, jalankan perintah berikut:
```bash
pm2 start index.js --name "anon-chat-bot"
```

### Langkah 3: Simpan Status & Konfigurasi Auto-Startup saat Boot
Agar PM2 otomatis menjalankan bot saat VPS restart/booting:
```bash
pm2 save
pm2 startup
```
*Catatan: Setelah menjalankan `pm2 startup`, PM2 akan memunculkan satu baris perintah `sudo env PATH=...` di terminal. Salin (copy) perintah tersebut dan jalankan di terminal Anda untuk mengaktifkan service startup.*

### Perintah Penting PM2 untuk Manajemen Bot
| Perintah | Keterangan |
| :--- | :--- |
| `pm2 status` | Melihat status proses bot yang berjalan |
| `pm2 logs anon-chat-bot` | Melihat log output/error bot secara real-time (`Ctrl + C` untuk keluar) |
| `pm2 restart anon-chat-bot` | Merestart ulang bot |
| `pm2 stop anon-chat-bot` | Menghentikan sementara bot |
| `pm2 monit` | Melihat monitoring pemakaian CPU & RAM secara interaktif |

---

## 7. Alternatif: Menjalankan Bot dengan Systemd

Jika Anda lebih memilih menggunakan service bawaan Linux (`systemd`) tanpa menginstall PM2:

1. Buat file service baru:
   ```bash
   sudo nano /etc/systemd/system/anon-chat-bot.service
   ```
2. Tempelkan konfigurasi berikut (sesuaikan `/root/Anon-Chat-Game` dengan path lokasi direktori jika Anda tidak memakai user `root`):
   ```ini
   [Unit]
   Description=Anonymous Telegram Chat Bot Service
   After=network.target

   [Service]
   Type=simple
   User=root
   WorkingDirectory=/root/Anon-Chat-Game
   ExecStart=/usr/bin/node index.js
   Restart=always
   RestartSec=10
   Environment=NODE_ENV=production

   [Install]
   WantedBy=multi-user.target
   ```
3. Aktifkan dan jalankan service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable anon-chat-bot
   sudo systemctl start anon-chat-bot
   ```
4. Cek status dan log service:
   ```bash
   sudo systemctl status anon-chat-bot
   sudo journalctl -u anon-chat-bot -f
   ```

---

## 8. Maintenance, Backup Database, & Update Kode

### A. Memperbarui Kode dari GitHub (Update)
Jika ada pembaruan fitur atau perbaikan bug di GitHub, lakukan langkah berikut di VPS:
```bash
cd ~/Anon-Chat-Game
git pull origin main
npm install
pm2 restart anon-chat-bot
```

### B. Backup Database (`data/bot.db`)
Database SQLite disimpan di file `data/bot.db`. Karena file ini masuk ke dalam `.gitignore` demi keamanan, pastikan Anda melakukan backup berkala secara manual atau via cronjob agar data antrian, statistik, dan riwayat ban tidak hilang.

Contoh perintah backup manual:
```bash
cp ./data/bot.db ./data/bot_backup_$(date +%F).db
```

---
*✨ Bot Anda sekarang sudah siap melayani pengguna Telegram selama 24 jam penuh tanpa henti!*
