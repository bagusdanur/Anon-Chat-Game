# 🚀 Product Requirement Document (PRD): Anon-Chat-Game — Live-Service AAA RPG Overhaul
**Status Produk: Aktif Production & Scaled (Patch 1.0 & Patch 1.1 Live)**

---

## 1. 🎯 Visi & Konsep Utama Produk
**Anon-Chat-Game** adalah evolusi mutlak dari bot percakapan acak ala Omegle di Telegram, yang disatukan dengan ekosistem permainan RPG Taktis bernuansa Fantasi Abadi (*Chronicles of Aldenmoor*). 

Berbeda dengan game bot tekstual lawas yang berulang dan membosankan, bot ini dirancang dengan prinsip **AAA Live-Service Flow ("Anti-Boredom")**: menghubungkan ketegangan eksplorasi dungeon berpasangan (Duo Co-Op), dinamika ekonomi perdagangan pasar gelap, serta pemanfaatan 7 Profesi Kuno agar pengalaman bertualang senantiasa menantang dan memikat.

---

## 2. 🗺️ Rekapitulasi Konten Live-Service (Saga V1: The Aldenmoor Crisis)

### Patch 1.0: "The Misty Frontier" (Level 1 – 7) — [PUBLISHED]
* **Lore**: Perbatasan Utara Aldenmoor tertutup Kabut Kelabu aneh (The Gray Mite) yang merusak akal suku goblin setempat.
* **Fitur & Arena**:
  * **Eksplorasi**: *Pinggiran Aldenmoor* (`aldenmoor_outskirts`), menampilkan event patroli kabut, kereta medis terjarah, dan pengintaian ksatria.
  * **Dungeon**: *Reruntuhan Goblin* (`goblin_ruins`), 15+ ruangan interaktif dengan 5 lapis penjagaan, penempaan besi rongsok (`/reforge`), dan klimaks melawan **Kepala Goblin Kabut (Chieftain)**.

### Patch 1.1: "Webs of the Silent Abyss" (Level 7 – 15) — [PUBLISHED]
* **Lore**: Sabotase benang sutra ungu beracun di Lembah Selatan! Aliansi Kultis Bawah Tanah menyekap **Ratu Laba-laba** untuk menyumbat sumber mata air kerajaan.
* **Fitur Anti-Bore & Ekonomi**:
  * **Eksplorasi**: *Lembah Sutra Beracun* (`spider_lair_valley`), mengharukan pemain menelusuri gas racun dan kepompong sutra maut.
  * **7 Profesi Kuno & Pasar Konsinyasi**: Pemain wajib memantau kesehatan HP dengan memanen obat herbal via `/gather`, menambang perak murni via `/mine`, serta memperdagangkannya melalui Escrow Market (`/market` & `/trade`).
  * **Dungeon Survival Thriller**: *Sarang Ratu Laba-laba* (`spider_nest`), 16 ruangan bercabang berteka-teki, pengoyakan kepompong berisiko ledakan janin laba-laba, dan pertarungan boss **Ratu Laba-laba (`ratu_laba`)** dengan cliffhanger Patch 1.2.

---

## 3. ⚙️ Spesifikasi Teknis & Arsitektur Data
* **Bahasa & Framework**: Node.js CommonJS (`require`), Telegraf v4, Express v5 (Web Dashboard).
* **Database Driver**: SQLite via `better-sqlite3`, ditenagai skema relasional tabel dan auto-migration secepat kilat.
* **Content Delivery Architecture**: **Modular Patch System**. Data tidak disimpan mati pada satu script masif, tetapi didistribusikan per file patch (`data/patches/saga_v1/*.json`). Aggregator otomatis (`data/patch_loader.js`) mengumpulkan seluruh saga bergengsi yang aktif ke dalam sistem.

---

## 4. 🛡️ Keamanan & Privasi Mutlak (Anonymous Zero-Trace)
1. **Perlindungan Identitas Pengguna**: Tidak boleh ada fungsi yang mengirimkan ID, username, nomor ponsel, atau nama lengkap pemain ke partner bicaranya saat fitting santuy di mode anonymous ataupun mode Duo Dungeon.
2. **Relay via CopyMessage**: Eksklusivitas sistem chat acak diamankan melalui metode `copyMessage` (bukan `forwardMessage`).
3. **Moderasi Terintegrasi**: Tersambung dengan perintah `/report`, ban otomatis anti-spam (>20 pesan/menit), serta pencatatan riwayat pelanggar di database SQLite.

---

## 5. 🔮 Rencana Prospektif (Upcoming Expansion: Patch 1.2+)
* **Patch 1.2 (Shadow Dragon's Wrath)**: Pertarungan merambat menuju Gunung Berapi Bayangan (Shadow Volcano). Akan memperkenalkan kebangkitan sistem **Guild Wars**, perakitan peninggalan artefak rupa naga, serta penaklukan Raid Boss 10-Player berkekuatan kosmik.
