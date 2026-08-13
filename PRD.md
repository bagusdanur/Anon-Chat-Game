# 🚀 Product Requirement Document (PRD): Anon-Chat-Game — Live-Service AAA RPG Overhaul
**Status Produk: Aktif Production & Scaled (SAGA I: Complete & Deployed to VPS)**

---

## 1. 🎯 Visi & Konsep Utama Produk
**Anon-Chat-Game** adalah evolusi mutlak dari bot percakapan acak ala Omegle di Telegram, yang disatukan dengan ekosistem permainan RPG Taktis bernuansa Fantasi Abadi (*Chronicles of Aldenmoor*). 

Berbeda dengan game bot tekstual lawas yang berulang dan membosankan, bot ini dirancang dengan prinsip **AAA Live-Service Flow ("Anti-Boredom")**: menghubungkan ketegangan eksplorasi dungeon berpasangan (Duo Co-Op), dinamika ekonomi perdagangan pasar gelap, serta pemanfaatan 7 Profesi Kuno agar pengalaman bertualang senantiasa menantang dan memikat.

---

## 2. 🗺️ Rekapitulasi Konten Live-Service (Saga V1: The Aldenmoor Crisis — 100% COMPLETE)

### Patch 1.0: "The Misty Frontier" (Level 1 – 7) — [PUBLISHED & LIVE]
* **Lore**: Perbatasan Utara Aldenmoor tertutup Kabut Kelabu aneh (The Gray Mite) yang merusak akal suku goblin setempat.
* **Fitur & Arena**:
  * **Eksplorasi**: *Pinggiran Aldenmoor* (`aldenmoor_outskirts`), menampilkan event patroli kabut, kereta medis terjarah, dan pengintaian ksatria.
  * **Dungeon**: *Reruntuhan Goblin* (`goblin_ruins`), 15+ ruangan interaktif dengan 5 lapis penjagaan, penempaan besi rongsok (`/reforge`), dan klimaks melawan **Kepala Goblin Kabut (Chieftain)**.

### Patch 1.1: "Webs of the Silent Abyss" (Level 7 – 15) — [PUBLISHED & LIVE]
* **Lore**: Sabotase benang sutra ungu beracun di Lembah Selatan! Aliansi Kultis Bawah Tanah menyekap **Ratu Laba-laba** untuk menyumbat sumber mata air kerajaan.
* **Fitur Anti-Bore & Ekonomi**:
  * **Eksplorasi**: *Lembah Sutra Beracun* (`spider_lair_valley`), mengharuskan pemain menelusuri gas racun dan kepompong sutra maut.
  * **7 Profesi Kuno & Pasar Konsinyasi**: Pemain wajib memantau kesehatan HP dengan memanen obat herbal via `/gather`, menambang perak murni via `/mine`, serta memperdagangkannya melalui Escrow Market (`/market` & `/trade`).
  * **Dungeon Survival Thriller**: *Sarang Ratu Laba-laba* (`spider_nest`), 16 ruangan bercabang berteka-teki, pengoyakan kepompong berisiko ledakan janin laba-laba, dan pertarungan boss **Ratu Laba-laba (`ratu_laba`)**.

### Patch 1.2: "Shadow Dragon's Wrath & Guild Wars" (Level 15 – 25) — [PUBLISHED & LIVE FINALE]
* **Lore**: Kultis Agung melarikan diri ke utara menuju Gunung Berapi Bayangan (`shadow_volcano`) untuk membicarakan kebangkitan naga kuno Malakor dengan merebus lava hitam yang mendidih.
* **Fitur Aliansi Guild & Puncak Anti-Boredom**:
  * **Eksplorasi**: *Gunung Berapi Bayangan*, medan ekstrem berderajat haba panas mutlak di mana pemain menggali Obsidian Murni (`/mine`), memanen Bunga Teratai Api (`/gather`), dan memancing Sisik Naga Perak (`/fish`).
  * **Dungeon Aliansi 20 Ruangan**: *Benteng Vulkanik Kuil Bayangan* (`volcano_fortress`), menantang pemain melompati jembatan rantai lava, menaklukan Golem Obsidian, dan membasuh perisai dengan eliksir tahan panas.
  * **Klimaks & Cliffhanger**: Menyerang Raid Boss **Naga Bayangan Malakor (`dragon_malakor`, HP: 7500)** dengan sinergi skuad Aliansi Guild. Kematian Malakor memecahkan segel kawah, melpaskan peringatan invasi makhluk luar angkasa menuju **Saga II: The Astral Horizon**!

---

## 3. ⚙️ Spesifikasi Teknis & Arsitektur Data
* **Bahasa & Framework**: Node.js CommonJS (`require`), Telegraf v4, Express v5 (Web Dashboard).
* **Database Driver**: SQLite via `better-sqlite3`, ditenagai skema relasional tabel dan auto-migration secepat kilat.
* **Content Delivery Architecture**: **Modular Patch System** (`data/patches/saga_v1/*.json` & `data/patch_loader.js`). Terbukti melompakan rasio kebosanan grinding pertempuran hingga HANYA **7.5%**, dengan rasio interaksi taktik dinamis menyentuh **92.5%**!

---

## 4. 🛡️ Keamanan & Privasi Mutlak (Discord Privacy & Party Safety)
1. **Perlindungan Identitas Pengguna**: Tidak boleh ada fungsi yang mengirimkan ID, username, nomor ponsel, atau nama lengkap pemain ke partner bicaranya saat fitting santuy di mode Discord ataupun mode Duo Dungeon.
2. **Relay via CopyMessage**: Eksklusivitas sistem chat acak diamankan melalui metode `copyMessage` (bukan `forwardMessage`).
3. **Stabilitas VPS Express 5**: Menggunakan syntax `/{*path}` pada rute wildcard web untuk mencegah kebocoran memori dan pembengkakan CPU VPS.

---

## 5. 🔮 Rencana Prospektif (Upcoming Expansion: Saga II - Patch 2.0+)
* **Saga II: The Astral Horizon (Patch 2.0 - Invasi Astral)**: Pembangkasan segel kawah gunung berapi telah meresahkan dimensi lain. Musim depan akan menghadirkan pesawat tempur eter, eksplorasi kepulauan melayang di atas Aldenmoor, serta pertempuran melawan komandan kosmik dari dimensi bintang astral!
