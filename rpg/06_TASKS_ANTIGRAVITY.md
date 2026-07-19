# Task Checklist: Persistent RPG v1 (untuk Antigravity)

Rujuk `02_CHARACTER_PROGRESSION.md`, `03_ECONOMY_GRINDING.md`,
`04_DATABASE_SCHEMA.md`, `05_COOP_DUNGEON_RAID.md` untuk detail angka.

## Fase 0 — Freeze Desain
- [ ] Review semua file desain, konfirmasi 3 jawaban open question di
      `00_JAWABAN_OPEN_QUESTIONS.md` (energi terpisah dungeon ticket,
      trade gold terbatas ke partner, command RPG di-intercept bukan
      di-relay).

## Fase 1 — DB Schema & Profile
- [ ] Migrasi `db.js`: buat 5 tabel (`rpg_users`, `rpg_inventory`,
      `items_catalog`, `transactions_log`, `dungeon_runs`) + index.
- [ ] Seed `items_catalog` dari tabel item di `03_ECONOMY_GRINDING.md`.
- [ ] `src/rpg/profile.js`: character creation flow (`/profile` kalau
      belum punya karakter → tampilkan pilihan class), tampilan
      `/profile` (level, XP bar, gold, stats, energi, tiket).
- [ ] Fungsi util `getOrCreateUser(telegramUserId)`.
- [ ] Test: `/profile` bikin karakter baru, cek row masuk DB dengan
      stats awal benar sesuai class.

## Fase 2 — Grinding Core
- [ ] `src/rpg/grind.js`: `/hunt`, `/fish`, `/mine`.
- [ ] Fungsi energi: `getCurrentEnergy(user)` (lazy regen calc),
      `spendEnergy(user, cost)`.
- [ ] RNG loot per rarity tier (§1 economy doc) + tabel per aktivitas.
- [ ] Battle simulation cepat untuk `/hunt` (bukan interaktif, langsung
      hasil).
- [ ] XP & level-up check tiap kali dapat XP (bisa naik >1 level).
- [ ] Test: spam `/hunt` sampai energi habis → pesan error jelas +
      waktu regen berikutnya.

## Fase 3 — Inventory, Shop, Daily
- [ ] `src/rpg/economy.js`: `/inv`, `/shop`, `/buy <item>`, `/daily`.
- [ ] Cooldown `/daily` 20 jam, cek `last_daily_claim_at`.
- [ ] Konsumsi item consumable (potion) dari inventory, kurangi quantity
      atau hapus row kalau quantity jadi 0.
- [ ] Test: beli potion dari shop → gold berkurang, item masuk `/inv`,
      pakai item → HP naik sesuai `effect_json`.

## Fase 4 — Crafting/Upgrade
- [ ] `/craft` atau `/upgrade <item>`: cek ore + gold cukup, apply
      `statBonusPerUpgrade`, increment `upgrade_tier` di `rpg_inventory`.
- [ ] Cap `maxUpgradeTier = 5`.
- [ ] Test: upgrade equipment tier 0→1→2, cek ATK/DEF efektif pemain
      naik sesuai (dihitung dari base stat + equipment bonus).

## Fase 5 — Co-op Dungeon Raid
- [ ] `src/rpg/coop.js`: `/dungeon` — cek paired + tiket kedua pemain.
- [ ] Pilih boss sesuai avg level (§2 raid doc), scale HP.
- [ ] Reuse/adaptasi combat engine turn-based (attack/skill/defend/item,
      telegraph, anti stale-vote via `turnNumber`) dari desain combat
      sebelumnya, tapi baca stats dari `rpg_users` (bukan hardcoded).
- [ ] Flush hasil ke DB: update `hp/xp/gold` kedua user, insert row
      `dungeon_runs`, kurangi `dungeon_tickets` di awal raid.
- [ ] Hook `/stop`/`/next` di tengah raid → batalkan raid (lihat §6
      raid doc, tiket tidak dikembalikan).
- [ ] Test: 2 akun raid boss tier 1, menang → cek reward masuk DB
      benar; kalah → HP jadi 20% max_hp; keluar tengah raid → state
      ke-clear, tiket tetap terpotong.

## Fase 6 — Gold Transfer
- [ ] `/give <amount>` — hanya ke partner yang sedang paired.
- [ ] Potong pajak 5%, catat di `transactions_log` (dua baris: transfer
      + pajak ke sistem).
- [ ] Test: `/give 100` ke partner → partner dapat 95, 5 tercatat
      sebagai pajak.

## Fase 7 — Polish & Anti-Spam
- [ ] Cooldown minimal antar command yang sama (misal `/hunt` gak bisa
      dipanggil <2 detik berturut-turut, mencegah race condition/RNG
      abuse via message ganda).
- [ ] Format pesan konsisten (emoji, HP bar util dari plan combat
      sebelumnya bisa dipakai ulang untuk raid).
- [ ] Playtest internal: cek pacing leveling (apakah level 1→10 kerasa
      wajar, gak kelamaan/kecepetan), revisi angka XP/energy kalau perlu
      (cukup ubah angka di `02_CHARACTER_PROGRESSION.md`, gak perlu ubah
      arsitektur).

## Acceptance Criteria Final
1. Progress (level/gold/item) tetap ada lintas sesi pairing berbeda.
2. Energi & dungeon ticket adalah resource terpisah, keduanya regen
   otomatis (lazy calc, bukan cron).
3. `/hunt`, `/fish`, `/mine` menghasilkan loot sesuai rarity table dan
   mempengaruhi ekonomi (gold, material craft).
4. `/dungeon` cuma bisa dipakai saat paired, scaling boss sesuai avg
   level, reward tersimpan permanen ke kedua akun.
5. `/give` terbatas ke partner aktif + pajak, tercatat di
   `transactions_log`.
6. Tidak ada command RPG yang ke-relay ke partner (semua di-intercept).
7. Tidak ada zombie state combat setelah `/stop`/`/next` di tengah raid.
