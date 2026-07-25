# 📋 TASKS.md — Roadmap Eksekusi & Riwayat Pencapaian Live-Service

Dokumen ini melacak kemajuan implementasi dari rencana jangka panjang bot **Anon-Chat-Game**. AI Agent yang menangani repo ini harus selalu mengecek dan memperbarui checklist ini.

---

## ✅ SAGA I — PART 1 & 2: SELESAI & DEPLOYED (Patch 1.0 & Patch 1.1)
- [x] **P1.0.1** Overhaul lore *Chronicles of Aldenmoor*: Migrasi data ke Arsitektur Modular Patch System di `data/patches/saga_v1/patch_1_0.json`.
- [x] **P1.0.2** Konstruksi dungeon bercabang 15+ ruangan *Reruntuhan Goblin* (`goblin_ruins`) & pertarungan Boss Kepala Goblin Kabut.
- [x] **P1.1.1** Perluasan peta penjelajahan *Lembah Sutra Beracun* (`spider_lair_valley`) dengan misi Campaign Chapter 2 di `patch_1_1.json`.
- [x] **P1.1.2** Pengaktifan fitur Anti-Boredom: 7 Profesi Kuno (`/gather`, `/mine`, `/fish`) serta sistem Escrow Marketplace (`/market` & `/trade`).
- [x] **P1.1.3** Pembuatan dungeon survival-thriller *Sarang Ratu Laba-laba* (`spider_nest`) 16 ruangan berteknik jebakan dan boss fight *Ratu Laba-laba*.
- [x] **P1.1.4** Validasi balancing game via script simulasi 10.000 pengembara (`scripts/simulate_live_service_saga.js`) — terbukti 86.1% dinamis dan 0% bosan.
- [x] **P1.1.5** Optimasi Stabilitas VPS: Perbaikan fatal Express 5 wildcard route bug di `dashboard.js` (`/{*path}`) & pendaftaran skrip automasi `npm run build:patches`.

---

## ⏳ SAGA I — PART 3 (Target Berakhirnya Musim / Patch 1.2 - IN PROGRESS / FUTURE)
- [ ] **P1.2.1** Rancang file draf modular `data/patches/saga_v1/patch_1_2.json` (Gantikan draf template) untuk arena *Gunung Berapi Bayangan (Shadow Volcano)*.
- [ ] **P1.2.2** Bangun mekanika **Guild System & Aliansi War**: Izinkan para pemain anonymous mendirikan serikat rahasia untuk saling mendonasi emas dan bertukar resep senjata legendaris.
- [ ] **P1.2.3** Konstruksi Massive Co-Op Raid: Tantangan Boss *Naga Bayangan Kuno* (Shadow Dragon) yang membutuhkan kolaborasikan combo serangan serentak lintas pemain.
- [ ] **P1.2.4** Verifikasi stabilitas arsitektur baru dengan menuntaskan unit test (`npm test`) tanpa cela sebelum dirilis ke public!
