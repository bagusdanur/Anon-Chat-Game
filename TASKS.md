# 📋 TASKS.md — Roadmap Eksekusi & Riwayat Pencapaian Live-Service

Dokumen ini melacak kemajuan implementasi dari rencana jangka panjang bot **Anon-Chat-Game**. AI Agent yang menangani repo ini harus selalu mengecek dan memperbarui checklist ini.

---

## ✅ SAGA I (PART 1, 2, & 3): 100% COMPLETED & DEPLOYED TO VPS
- [x] **P1.0.1** Overhaul lore *Chronicles of Aldenmoor*: Migrasi data ke Arsitektur Modular Patch System di `data/patches/saga_v1/patch_1_0.json`.
- [x] **P1.0.2** Konstruksi dungeon bercabang 15+ ruangan *Reruntuhan Goblin* (`goblin_ruins`) & pertarungan Boss Kepala Goblin Kabut.
- [x] **P1.1.1** Perluasan peta penjelajahan *Lembah Sutra Beracun* (`spider_lair_valley`) dengan misi Campaign Chapter 2 di `patch_1_1.json`.
- [x] **P1.1.2** Pengaktifan fitur Anti-Boredom: 7 Profesi Kuno (`/gather`, `/mine`, `/fish`) serta sistem Escrow Marketplace (`/market` & `/trade`).
- [x] **P1.1.3** Pembuatan dungeon survival-thriller *Sarang Ratu Laba-laba* (`spider_nest`) 16 ruangan berteknik jebakan dan boss fight *Ratu Laba-laba*.
- [x] **P1.2.1** Rancang file modular puncakan `data/patches/saga_v1/patch_1_2.json` (`published: true`) untuk arena ekstrem *Gunung Berapi Bayangan (Shadow Volcano)*.
- [x] **P1.2.2** Konstruksi Dungeon Aliansi Guild 20 Ruangan: *Benteng Vulkanik Kuil Bayangan* (`volcano_fortress`), menempakan baja Obsidian dan Bunga Teratai Api.
- [x] **P1.2.3** Tantangan Raid Boss Kuno *Naga Bayangan Malakor* (HP: 7500) dengan narasi cliffhanger pembuka Gerbang Astral.
- [x] **P1.2.4** Validasi stabilitas & balancing via script simulasi 10.000 pengembara (`npm run simulate:saga`) — terbukti **92.5% Interaksi Dinamis** dan hanya **7.5% pertarungan monoton (0% bosan)**!
- [x] **P1.2.5** Deployment langsung ke Server VPS Linux production menggunakan SSH, Git Pull, dan pemulihan memori PM2.

---

## ✅ SAGA II (THE ASTRAL HORIZON / PATCH 2.0): COMPLETED & ACTIVATED
- [x] **P2.0.1** Buat struktur folder saga baru: `data/patches/saga_v2/patch_2_0.json` (`published: true`).
- [x] **P2.0.2** Rancang arena Kepulauan Melayang (*Floating Ethereal Isles*) dengan gravitasi rendah dan monster kristal kosmik dari luar angkasa (`ethereal_isles`).
- [x] **P2.0.3** Misi Campaign Chapter 4 (Act I & Act II) dengan peluncuran Bahtera Guild (*Airship Ascent*) menembus Void Astral.
- [x] **P2.0.4** Penggabungan otomatis via aggregator `npm run build:patches` dan uji coba regresi lulus 100%!

