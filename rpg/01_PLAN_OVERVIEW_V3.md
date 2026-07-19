# Plan Overview v3: Persistent Discord-Style RPG

> Ini menggantikan plan combat-in-memory sebelumnya (Aldenmoor v2). Arah
> final: **persistent, command-based, grinding+ekonomi+leveling**, co-op
> cuma di fitur dungeon/raid. Cerita linear dibuang total, sesuai
> keputusan di draft Antigravity.

## Kenapa Pivot Ini Lebih Bagus

Versi in-memory (branching story / battle sekali jalan) selalu "abis" —
begitu sesi/battle kelar, gak ada yang nyisa buat pemain balik lagi
selain main ulang dari nol. RPG ala Discord bot (Epic RPG dkk) betah
dimainkan lama justru karena **progress numpuk**: level naik pelan-pelan,
gold ke-collect, equipment membaik — ada alasan buka bot besok lagi.
Itu yang dari awal hilang di versi cerita.

## Prinsip Arsitektur

1. **Solo progression = personal, lintas sesi pairing.** Data nempel ke
   `telegram_user_id`, bukan ke `pairKey`. Ganti partner berkali-kali gak
   ngaruh ke level/gold.
2. **Co-op = fitur eksklusif saat paired.** `/dungeon` butuh partner
   aktif, hasil raid (loot, XP) masuk ke masing-masing akun persisten.
3. **Command RPG di-intercept, gak di-relay ke partner** (lihat
   `00_JAWABAN_OPEN_QUESTIONS.md` §3) — bisa dipakai kapan aja, paired
   atau tidak, kecuali `/dungeon`.
4. **Semua state penting di SQLite**, in-memory cuma dipakai untuk
   sesi combat *yang sedang berlangsung* (raid turn-based), sama seperti
   pola `rpsActive` dulu — begitu combat selesai, hasil akhir (XP, gold,
   loot, HP) di-flush ke DB.

## Scope v1 (yang dibangun sekarang)

- Profil persisten + leveling (`/profile`)
- Grinding: `/hunt`, `/fish`, `/mine`, `/daily`
- Energi/stamina + dungeon ticket (terpisah, lihat §1 jawaban open Q)
- Inventory & shop (`/inv`, `/shop`)
- Crafting/upgrade equipment (`/craft` atau `/upgrade`)
- Co-op dungeon raid (`/dungeon`)
- Gold transfer terbatas ke partner (`/give`)

## Eksplisit Out-of-Scope v1 (backlog, jangan dikerjain dulu)

- Guild/clan system
- PvP antar pemain
- Item trading (selain gold)
- Prestige/reset system
- Leaderboard global (`/top`) — nice-to-have, bisa nyusul kalau v1 stabil

## Fase Kerja

| Fase | Isi |
|---|---|
| 0 | Freeze desain (semua file ini disetujui) |
| 1 | DB schema + `/profile` + character creation |
| 2 | Grinding core: `/hunt`, `/fish`, `/mine` + energi |
| 3 | Inventory + shop + `/daily` |
| 4 | Crafting/upgrade equipment |
| 5 | Co-op dungeon raid (reuse combat engine turn-based) |
| 6 | `/give` gold transfer + pajak |
| 7 | Polish, balancing pass, anti-spam/cooldown |

Detail tiap fase ada di `06_TASKS_ANTIGRAVITY.md`.

## File Terkait

- `00_JAWABAN_OPEN_QUESTIONS.md` — keputusan desain awal
- `02_CHARACTER_PROGRESSION.md` — class, stats, leveling, energi
- `03_ECONOMY_GRINDING.md` — hunt/fish/mine, loot table, shop, crafting
- `04_DATABASE_SCHEMA.md` — schema SQLite lengkap
- `05_COOP_DUNGEON_RAID.md` — desain raid boss & distribusi loot
- `06_TASKS_ANTIGRAVITY.md` — checklist implementasi per fase
