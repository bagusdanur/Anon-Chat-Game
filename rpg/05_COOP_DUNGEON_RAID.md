# Co-op Dungeon Raid — `/dungeon`

## 1. Syarat Mulai

- Kedua pemain sedang **paired aktif** (pola sama seperti `/game` lama).
- Kedua pemain punya **≥1 dungeon ticket** (dipotong 1 dari masing-masing
  saat raid dimulai, bukan cuma yang ngetik `/dungeon`).
- Kalau salah satu belum bikin karakter (`/profile` belum diisi) → bot
  suruh `/profile` dulu.

## 2. Pemilihan Boss & Scaling

Boss dipilih dari tabel tier berdasarkan **rata-rata level kedua
pemain**, HP & ATK boss di-scale sedikit lagi biar tetap menantang buat
kombinasi level yang timpang:

| Tier | Avg Level | Boss | Base HP | Base ATK | Base DEF |
|---|---|---|---|---|---|
| 1 | 1–15 | Kepala Goblin | 150 | 8–12 | 3 |
| 2 | 16–35 | Ratu Laba-laba | 320 | 14–20 | 6 |
| 3 | 36–60 | Naga Bayangan | 600 | 22–32 | 10 |
| 4 | 61+ | Raja Terkutuk Aldenmoor | 1000 | 30–45 | 14 |

```
scaledBossHp = baseHp * (1 + (avgLevel - tierMinLevel) * 0.03)
```
(HP naik ~3% tiap level di atas ambang bawah tier, biar gak stuck flat).

## 3. Mekanik Turn-Based (reuse engine dari plan lama, scale up)

Sama seperti desain Aldenmoor v2 sebelumnya:
- Kedua pemain submit aksi tiap turn (serang/skill/defend/item) via tombol.
- Skill & cooldown pakai stat persisten dari `rpg_users` (ATK/DEF real,
  bukan angka fiktif kayak sebelumnya).
- Telegraph attack berat tiap beberapa turn (skala boss lebih sering,
  tiap 2 turn mulai tier 3 ke atas).
- Anti stale-vote: `turnNumber` di callback data, sama pola seperti
  sebelumnya.
- In-memory `CombatState` selama raid berlangsung (`Map<pairKey, state>`),
  di-flush ke DB (`dungeon_runs`, update `rpg_users.hp/xp/gold`) begitu
  raid selesai (menang/kalah/salah satu keluar chat).

## 4. Reward & Loot Distribution

- **Menang**: XP & gold dibagi rata ke KEDUA akun (bukan cuma yang
  inisiasi). Loot legendary-tier di-roll SEKALI, dikasih ke salah satu
  pemain secara acak (jangan dobel ke keduanya — biar item legendary
  tetap langka), diumumkan jelas siapa yang dapat.
- **Kalah**: HP kedua pemain jadi 20% max_hp (bukan 0, biar gak
  ngehukum kelewat keras), tidak dapat reward, tiket tetap kepotong
  (biar ada konsekuensi buat gak asal push boss kejauhan di atas level).

## 5. Loot Table Legendary per Boss Tier

| Tier | Legendary Drop |
|---|---|
| 1 | Pedang Goblin Bertuah (+6 ATK) |
| 2 | Jaring Sutra Ratu (+8 DEF) |
| 3 | Sisik Naga Bayangan (bahan craft equipment tier tertinggi) |
| 4 | Mahkota Terkutuk (+10 ATK & DEF, item kosmetik profil juga) |

## 6. Hook Cleanup

- `/stop` atau `/next` di tengah raid → raid dianggap batal (bukan
  kalah, bukan menang), tiket TIDAK dikembalikan (biar gak dieksploitasi
  buat "restart" cari RNG bagus), state combat di-clear dari memory,
  catat `result: 'lose'` + `reason: 'abandoned'` di `dungeon_runs` buat
  data internal (opsional field tambahan `abandoned BOOLEAN`).
