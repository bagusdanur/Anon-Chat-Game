# Balance Fix Plan — Anon Chat Game RPG

---

## Hasil Analisis Balance (Subagent)

| Area | Rating | Masalah Utama |
|------|--------|---------------|
| ⚡ Energi | ✅ OK | Sudah ideal |
| 📋 Daily Quest | ✅ OK | Reward wajar |
| 📈 Progression | ⚠️ | Bottleneck Lv 10-20 (5× lipat dari Lv 1-10) |
| 💰 Gold Economy | ⚠️ | Daily reward 30g terlalu kecil |
| 🎲 Item & Loot | ⚠️ | Legendary 0.2% terlalu langka |
| ⚒️ Craft & Upgrade | ⚠️ | Besi tidak ada di Mine T1, full upgrade ekstrem |
| 🏰 Dungeon | ❌ | Lv 1 party tidak bisa menang apapun |
| ⚔️ Class Balance | ❌ | Pencuri OP 2.8×, Penyihir basic attack bug |

---

## 🔴 PRIORITAS 1 — Fix Bug & Balance Kritis

### Fix 1: Penyihir basic attack pakai `magic_atk` bukan `atk` (BUG)
**File:** `coop.js` baris ~99
```
SEKARANG: baseDmg = player.atk → Penyihir Lv1 cuma 1 dmg di Goblin!
FIX: baseDmg = cls.damageType === 'magic' ? player.magicAtk : player.atk
```

### Fix 2: Dungeon Goblin HP 80→55 untuk Lv 1 party
**File:** `coop.js` BOSS_TIERS tier 1
```
baseHp: 80 → 55, baseAtk: [5,8] → [3,6]
Efek: Lv 1 party bisa menang (6-8 turn vs 14 turn sebelumnya)
```

### Fix 3: Nerf Pencuri Backstab
**File:** `db_rpg.js` CLASS_DEFS.pencuri
```
skillMulti: 3.0 → 2.2
critMulti: 2.0 → 1.8
Efek: Pencuri masih kuat tapi tidak 2.8× kelas lain
```

### Fix 4: Naikkan HP base Penyihir
**File:** `db_rpg.js` CLASS_DEFS.penyihir
```
base_hp: 35 → 42 (biar survive lebih lama)
```

---

## 🟡 PRIORITAS 2 — Progression & Economy

### Fix 5: XP formula lebih ringan
**File:** `db_rpg.js`
```
xpToNextLevel: level^1.5 → level^1.3
Efek: Lv10→11 turun dari 1581 → 1040 XP (35% ringan)
```

### Fix 6: Daily reward naik
**File:** `economy.js`
```
Gold: 30 → 80g
XP: 10 → 25
```

### Fix 7: Tambah besi_rongsok ke Mine T1
**File:** `grind.js` MINE_LOOT_T1
```
Tambah 'besi_rongsok' di uncommon/rare
Efek: Upgrade tier 1 bisa dari Lv 1
```

### Fix 8: Fix sell price
**File:** `db_rpg.js` SEED_ITEMS
```
jubah_terkutuk: sell_price 0 → 40g
ramuan_energi: sell_price 15 → 30g
sepatu_rusak: sell_price 0 → 2g
```

---

## 🟢 PRIORITAS 3 — Fine Tuning

### Fix 9: Legendary hunt rate 0.2% → 0.5%
### Fix 10: Kurangi craft besi requirement
### Fix 11: Kurangi upgrade tier 4-5 gold cost

---

## Files yang diubah:
- `src/rpg/db_rpg.js` (Fix 3, 4, 5, 8, 10)
- `src/rpg/coop.js` (Fix 1, 2)
- `src/rpg/grind.js` (Fix 7, 9)
- `src/rpg/economy.js` (Fix 6, 11)
