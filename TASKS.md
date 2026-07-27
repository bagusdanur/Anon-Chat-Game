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

## ✅ SAGA II (THE ASTRAL HORIZON / PATCH 2.0, 2.1, 2.2, & 2.3): 100% COMPLETED & DEPLOYED TO VPS
- [x] **P2.0.1** Buat struktur folder saga baru: `data/patches/saga_v2/patch_2_0.json` (`published: true`).
- [x] **P2.0.2** Rancang arena Kepulauan Melayang (*Floating Ethereal Isles*) dengan gravitasi rendah dan monster kristal kosmik dari luar angkasa (`ethereal_isles`).
- [x] **P2.0.3** Misi Campaign Chapter 4 (Act I & Act II) dengan peluncuran Bahtera Guild (*Airship Ascent*) menembus Void Astral.
- [x] **P2.0.4** Penggabungan otomatis via aggregator `npm run build:patches` dan uji coba regresi lulus 100%!
- [x] **P2.1.1** Eksekusi Patch 2.1: Dungeon 15 Ruangan *Benteng Kristal Astral* (`astral_citadel`) dengan Raid Boss *Leviathan Kosmik*.
- [x] **P2.1.2** Campaign Chapter 5 (Act I: Titik Temu Astral & Act II: Penaklukan Leviathan Kosmik) serta validasi simulasi 100% Lulus!
- [x] **P2.2.1** Rilis Patch 2.2: Arena *Suaka Gerhana Abadi* (`eclipse_sanctuary`), Dungeon 15-Ruangan *Menara Anti-Materi* (`antimatter_spire`), dan Campaign Chapter 6 melawan Archon Valtharor.
- [x] **P2.3.1** Rilis Patch 2.3 (Saga II Ultimate Grand Finale): Arena Puncakan *Singgahsana Ruang Hampa* (`celestial_void_throne`), Dungeon Aliansi 20-Ruangan *Istana Tahta Kaisar* (`emperor_throne_citadel`), dan Raid Boss *Kaisar Kosmik Xylarion* (HP: 25.000 / Level 60 Cap).

## ✅ ITEM DELIVERY & UNIFIED SHOP
- [x] Satukan seluruh toko NPC level rendah/tinggi ke `/shop` dan `/buy` bernomor.
- [x] Reward campaign diberikan atomik dan idempotent; reward Saga II dinormalisasi ke item katalog valid.
- [x] Material unik region Saga I–II dapat diperoleh dari eksplorasi, gathering, mining, dan dungeon.
- [x] Kail/Beliung+ benar-benar meningkatkan rarity fishing/mining.
- [x] Alchemy, gem crafting/drop/shop, dan resep endgame aktif.
- [x] Dungeon dapat menjatuhkan Equipment V2 langsung dengan quality dan affix acak.
- [x] Dashboard RPG Operations menampilkan telemetry delivery item tanpa identitas pemain.

---

## 🚀 ROADMAP MASA DEPAN: SAGA III (UNDERWORLD OF THE FORGOTTEN REALM / PATCH 3.0+)
- [ ] **P3.0.1** Inisiasi struktur direktori modular `data/patches/saga_v3/patch_3_0.json`.
- [ ] **P3.0.2** Rancang arena Bawah Tanah Dalam (*Abyssal Depths & Forgotten Sand*) dengan monster purba inti bumi.
- [ ] **P3.0.3** Implementasi sistem Eksplorasi Bawah Tanah, relik bumi abadi, dan Raid Boss Raksasa Forgotten Realm (Level 60–75).
