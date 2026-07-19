# Jawaban Open Questions (dari draft Antigravity)

## 1. Sistem Energi/Stamina?

**Ya, pakai.** Tapi dengan catatan penting: jangan disatukan dengan
resource `/dungeon`. Alasan & detail:

- Energi/stamina cuma buat **solo grinding** (`/hunt`, `/fish`, `/mine`).
- `/dungeon` (co-op) pakai resource terpisah: **Dungeon Ticket**
  (3 tiket gratis/hari, reset tengah malam). Kalau digabung ke energi
  yang sama, pemain yang rajin grinding solo bisa kehabisan energi pas
  partner-nya ngajak raid — bikin co-op-nya malah nyusahin, padahal
  fitur unggulan bot ini justru co-op.
- Angka konkret ada di `02_CHARACTER_PROGRESSION.md` §3.

## 2. Trade Gold Antar Pemain?

**Boleh, tapi dibatasi ke partner yang sedang paired aja (`/give`),
bukan trade bebas ke sembarang user ID.** Alasan:
- Trade bebas ke sembarang ID gampang disalahgunakan (RMT, akun ganda
  transfer gold ke akun utama).
- Dibatasi ke partner aktif → natural, sesuai konteks "kerja sama
  sesama partner chat", risiko abuse jauh lebih kecil.
- Kena pajak 5% (gold sink) biar ekonomi gak inflasi.
- **Item trading TIDAK dulu di v1** (rawan duplication bug/exploit).
  Bisa jadi backlog v2 kalau ekonomi udah stabil.

## 3. Command Solo Jalan di Mana (Penting, Bukan Cuma Pertanyaan Antigravity)

Ini perlu diputuskan eksplisit karena bot ini basisnya **anonymous chat
pairing**: kalau `/hunt` dkk diketik pas lagi paired, apakah itu ke-relay
ke partner (stranger) atau di-intercept bot?

**Keputusan: semua command RPG (`/hunt`, `/fish`, `/mine`, `/profile`,
`/shop`, `/inv`, `/craft`, `/daily`) di-intercept bot dan dibalas
**privat ke pengirim saja**, TIDAK di-relay ke partner** — baik saat
paired maupun tidak. Command RPG bisa dipakai kapan aja, gak perlu
nunggu `/search`/paired. Hanya `/dungeon` yang butuh status paired aktif
(karena memang butuh 2 orang).

Ini konsisten dengan pola command lama (`/stop`, `/next`) yang juga
di-intercept, bukan di-relay — jadi gak perlu ubah arsitektur relay yang
sudah ada.

## Keputusan Lanjut

Aku lanjut bikin desain lengkap dengan asumsi 3 poin di atas. Kalau mau
diubah (misal trade item mau langsung diizinkan), tinggal revisi di
`02_CHARACTER_PROGRESSION.md` / `03_ECONOMY_GRINDING.md` sebelum masuk
coding — gak perlu ubah arsitektur database.
