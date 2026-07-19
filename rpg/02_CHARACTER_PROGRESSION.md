# Character Progression — Class, Leveling, Energi

## 1. Class (dipilih sekali saat karakter dibuat, permanen di v1)

| Class | Base HP | Base ATK | Base DEF | Growth/level | Trait pasif |
|---|---|---|---|---|---|
| ⚔️ Ksatria | 50 | 5 | 5 | +8 HP, +1.5 ATK, +2 DEF | -10% damage diterima saat `/dungeon` |
| 🔥 Penyihir | 35 | 8 | 2 | +5 HP, +2.5 ATK, +1 DEF | +15% XP dari `/hunt` |
| 🗡️ Pencuri | 40 | 6 | 3 | +6 HP, +2 ATK, +1.5 DEF | +1% bonus gold per 5 level (maks +20%) |

Growth dibulatkan ke bawah tiap level up. Reclass TIDAK ada di v1
(backlog: item "Scroll of Rebirth" di v2 kalau perlu).

## 2. Leveling Curve

```
xpToNextLevel(level) = floor(50 * level^1.5)
```

Contoh: Lv1→2 = 50 XP, Lv5→6 ≈ 559 XP, Lv10→11 ≈ 1581 XP,
Lv20→21 ≈ 4472 XP. Curve makin landai growth stat-nya di level tinggi
biar gak perlu rebalance monster tiap saat — cukup tambah tier monster
baru (lihat `03_ECONOMY_GRINDING.md`).

XP sumber:
- `/hunt` menang: XP flat sesuai tier monster (lihat §2 economy doc)
- `/dungeon` menang: XP jauh lebih besar (raid reward)
- `/daily`: XP kecil flat (biar gak jadi sumber grinding utama)

Level up otomatis dicek tiap kali XP nambah (bisa naik >1 level
sekaligus kalau XP gain besar, misal abis raid).

## 3. Energi / Stamina (Solo Grinding)

| Field | Nilai |
|---|---|
| `energy_max` | 10 (bisa naik jadi 12/15 lewat upgrade shop di v2, v1 tetap 10) |
| Regen | +1 energi / 5 menit real-time (dihitung lazy: `min(max, current + floor((now - last_update)/5min))`, bukan cron job) |
| Cost `/hunt` | 2 energi |
| Cost `/fish` | 1 energi |
| Cost `/mine` | 3 energi |
| Cost `/daily` | 0 (gak makan energi) |

Kalau energi kurang dari cost aktivitas → bot balas:
`"⚡ Energimu cuma {current}/{max}. Butuh {cost} buat {activity}. Regen +1 tiap 5 menit."`

## 4. Dungeon Ticket (Co-op, TERPISAH dari energi)

| Field | Nilai |
|---|---|
| `dungeon_tickets` | maks 3, reset ke 3 tiap jam 00:00 (timezone WIB) |
| Cost per `/dungeon` | 1 tiket (dipotong dari KEDUA pemain saat raid dimulai, bukan cuma yang inisiasi) |
| Kalau salah satu tiket habis | raid gak bisa mulai, bot kasih tau siapa yang tiketnya habis |

Alasan reset harian (bukan regen per-5-menit kayak energi): raid itu
"event" bukan grinding rutin, biar terasa spesial dan gak di-spam.

## 5. HP saat ini vs Max HP

`hp` (current) disimpan terpisah dari `max_hp` (dihitung dari base+growth
tiap level). HP berkurang cuma kalau kalah di `/hunt` atau `/dungeon`
(lihat mekanik kalah di economy/raid doc), regen HP:
- +10% max_hp tiap 10 menit (lazy calc, sama seperti energi)
- Atau instan penuh kalau pakai potion dari `/inv`

## 6. Struktur Data Ringkas (detail penuh di `04_DATABASE_SCHEMA.md`)

```
rpg_users:
  telegram_user_id (PK)
  class_name
  level, xp
  gold
  hp, max_hp
  atk, def
  energy_current, energy_last_update
  dungeon_tickets, dungeon_tickets_reset_at
  last_daily_claim_at
  created_at, updated_at
```
