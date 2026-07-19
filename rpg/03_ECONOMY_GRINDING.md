# Economy & Grinding — Hunt / Fish / Mine / Shop / Craft

## 1. Rarity Tier (dipakai semua sumber loot)

| Rarity | Drop chance | Warna label |
|---|---|---|
| Common | 70% | ⚪ |
| Uncommon | 20% | 🟢 |
| Rare | 8% | 🔵 |
| Epic | 1.8% | 🟣 |
| Legendary | 0.2% | 🟠 |

Roll rarity dulu, baru pilih item spesifik di rarity itu (lihat tabel
per aktivitas).

## 2. `/hunt` — Monster Tier per Level Range

| Tier | Level Range | Monster | HP musuh | ATK musuh | XP reward | Gold reward |
|---|---|---|---|---|---|---|
| 1 | 1–10 | Slime, Goblin, Babi Hutan | 15–25 | 2–4 | 12–20 | 5–15 |
| 2 | 11–25 | Orc Perampok, Laba-laba Raksasa, Bandit | 30–50 | 5–9 | 30–55 | 20–45 |
| 3 | 26–50 | Troll, Wyvern Muda, Kultis | 60–100 | 10–16 | 70–130 | 50–100 |
| 4 | 51+ | Naga Muda, Lich, Ksatria Terkutuk | 120–200 | 18–28 | 180–320 | 120–250 |

`/hunt` = 1 battle cepat otomatis (bukan turn-based interaktif kayak
raid — biar solo grinding cepat, gak perlu klik tombol berkali-kali):
simulasikan beberapa ronde di backend, kirim hasil ringkas (menang/kalah
+ damage diterima + loot). Kalau kalah: HP berkurang signifikan, gak
dapat XP/gold, tapi gak ada penalti tambahan (biar gak nyebelin).

Loot per rarity (contoh, isi lengkap bisa nambah seiring waktu):
- Common: Daging Mentah (jual 3g), Kulit Kasar (jual 5g)
- Uncommon: Ramuan Kecil (heal 15% max_hp), Besi Rongsok (bahan craft)
- Rare: Pedang Karatan (+2 ATK item, bisa di-craft jadi lebih baik)
- Epic: Jubah Terkutuk (+5 DEF)
- Legendary: Fragmen Naga (bahan craft equipment tertinggi, TIDAK bisa
  dijual — biar legendary craft path meaningful)

## 3. `/fish` — Tier Ikan

| Tier | Level Range | Ikan | Jual (gold) |
|---|---|---|---|
| 1 | 1–15 | Ikan Teri, Ikan Mujair | 3–8 |
| 2 | 16–35 | Ikan Salmon, Kepiting | 10–25 |
| 3 | 36+ | Ikan Paus Mini (rare only), Mutiara (epic) | 50–150 |

Fishing gak ada "kalah", cuma variasi hasil (kadang dapat "Sepatu Bot
Rusak" — 0 gold, flavor humor ala Discord bot). XP kecil per fish
(5–15), fokus utama fishing adalah gold, bukan XP.

## 4. `/mine` — Tier Ore

| Tier | Level Range | Ore | Fungsi |
|---|---|---|---|
| 1 | 1–20 | Tembaga, Batu Bara | Bahan craft dasar |
| 2 | 21–45 | Besi, Perak | Bahan craft menengah |
| 3 | 46+ | Emas, Berlian | Bahan craft tinggi + jual mahal (jual: Berlian 200-400g) |

Mining paling mahal energi (3) tapi hasil jual/craft paling tinggi —
insentif buat gak cuma spam `/hunt`.

## 5. `/daily`

- Reward flat: 30 gold + 10 XP + 1 Ramuan Kecil.
- Cooldown 20 jam (bukan pas 24 jam biar gak gampang kelewat 1 hari
  kalau main jam beda tiap hari — pola umum bot Discord).

## 6. Shop (`/shop`, `/buy <item>`)

| Item | Harga | Efek |
|---|---|---|
| Ramuan Kecil | 15g | Heal 15% max_hp |
| Ramuan Besar | 50g | Heal 50% max_hp |
| Kail Pancing+ | 200g | Naikkan chance rarity `/fish` 1 tingkat (v1: flat, gak stacking) |
| Beliung Tambang+ | 300g | Naikkan chance rarity `/mine` 1 tingkat |

## 7. Crafting / Upgrade (`/craft`, `/upgrade`)

Equipment (senjata/armor) yang didapat dari loot Rare ke atas bisa
di-upgrade pakai ore + gold:

```
upgradeCost(currentTier) = {
  ore: currentTier * 3,      // ore sesuai tier equipment
  gold: currentTier * 100,
}
statBonusPerUpgrade = +2 ATK (senjata) atau +2 DEF (armor)
maxUpgradeTier = 5  // v1: gak ada fail chance, biar simpel dulu
```

Fail chance / risk-upgrade di tier tinggi bisa jadi fitur v2 kalau
ekonomi udah kelihatan butuh gold sink lebih besar.

## 8. Gold Sink Summary (biar ekonomi gak inflasi)

- Shop items (potion, tool upgrade)
- Crafting/equipment upgrade
- Pajak 5% di `/give` antar partner
- (v2 opsional) refill energi/dungeon ticket pakai gold
