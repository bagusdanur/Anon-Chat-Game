# Bug Analysis Plan — Anon Chat Bot Game

> **Hasil analisis statis kode.** Semua bug ditemukan dari pembacaan langsung source code.

---

## 🔴 BUG KRITIS (Crash / Logic Fatal)

---

### Bug #1 — `ReferenceError: claimedCount is not defined` di `/quest`
**File:** `index.js` baris 365  
**Severity:** 🔴 CRASH — bot error tiap kali user ketik `/quest`

**Root Cause:**
```js
// baris 365 — variabel tidak pernah dideklarasikan
if (q.claimed) claimedCount++;  // ← claimedCount tidak ada!
```
Variabel yang benar adalah `totalClaimed` (dideklarasikan di baris 350), tapi tidak dipakai.
Loop ini juga tidak perlu karena baris 369 sudah hitung ulang: `quests.filter(q => q.claimed).length`.

**Fix:**
```js
// Hapus baris 365 ini saja:
// if (q.claimed) claimedCount++;
```

---

### Bug #2 — `totalAtk` dan `totalDef` tidak terdefinisi di `/party`
**File:** `index.js` baris 410  
**Severity:** 🔴 CRASH — bot error tiap `/party`

**Root Cause:**
```js
msg += `   Avg Level: ${avgLv} | Total ATK: ${totalAtk} | Total DEF: ${totalDef}`;
// ← totalAtk dan totalDef tidak pernah dihitung!
```

**Fix:**
```js
const clsA = CLASS_DEFS[user.class_name];
const clsB = CLASS_DEFS[partner.class_name];
// Tambahkan sebelum baris msg:
const totalAtk = (user.atk || 0) + (partner.atk || 0);
const totalDef = (user.def || 0) + (partner.def || 0);
```

---

### Bug #3 — `/upgrade` tidak support staff & accessory
**File:** `economy.js` baris 385  
**Severity:** 🟡 MEDIUM — user kebingungan karena staff/accessory tidak bisa di-upgrade padahal di UI seolah bisa

**Root Cause:**
```js
if (!['weapon', 'armor'].includes(invItem.category))
  return ctx.reply('❌ Hanya senjata/armor yang bisa di-upgrade.');
```
Tapi stat label di baris 392 hanya cek `weapon` vs `armor`:
```js
const statType = invItem.category === 'weapon' ? 'ATK' : 'DEF';
```
Kalau nanti staff/accessory dibuka, label-nya salah.

---

## 🟡 BUG LOGIKA / GAMEPLAY RUSAK

---

### Bug #4 — Equipment di `/profile` & `/equip` pakai logika LAMA (tidak pakai kolom `equipped`)
**File:** `profile.js` baris 73–78, `index.js` baris 463–465  
**Severity:** 🟡 MEDIUM — Equipment yang di-equip tidak tampil benar di `/profile`

**Root Cause:**
Di `profile.js`, fungsi `renderProfile` TIDAK pakai `getEquipped()` (yang baca kolom `equipped=1`). Malah pakai logika lama:
```js
// profile.js line 73–78 — logika "terbaik per slot" bukan "yang di-equip"
for (const item of getInventory(user.telegram_user_id)) {
  if (!item.effect_json || ...) continue;
  if (equipped[item.category] && equipped[item.category].rarity > item.rarity) continue;
  equipped[item.category] = item;  // ← ambil yang rarity tertinggi, bukan yang di-equip!
}
```
Begitu juga di `/equip` (index.js baris 463–465) pakai `getEquippedBonus` tapi display pakai `getEquipped`.

**Fix:** Ganti bagian equipment di `renderProfile` untuk pakai `getEquipped(userId)` yang sudah benar.

---

### Bug #5 — Shield check di dungeon pakai `player.classId` bukan `uid`
**File:** `coop.js` baris 169  
**Severity:** 🟡 MEDIUM — Shield tidak pernah aktif! Boss selalu deal full damage

**Root Cause:**
```js
if (hasStatusEffect(player.classId, 'shield') || player.defending) {
  // ↑ player.classId = 'ksatria'/'penyihir'/'pencuri' (string nama kelas)
  // hasStatusEffect cari di DB dengan user_id — harusnya pakai uid (chatId)!
```
`addStatusEffect` dipanggil dengan `uid` (chatId angka), tapi `hasStatusEffect` dicek dengan `player.classId` (string nama kelas). Selalu false → Shield tidak pernah aktif.

**Fix:**
```js
// Ganti di loop boss attack:
if (hasStatusEffect(uid, 'shield') || player.defending) {
```
Tapi `uid` tidak tersedia di loop ini. Perlu refactor sedikit:
```js
for (const [uid, player] of Object.entries(raid.players)) {
  // gunakan uid bukan player.classId
  if (hasStatusEffect(uid, 'shield') || player.defending) {
```

---

### Bug #6 — Status effect burn/bleed di dungeon tidak deal damage ke player HP
**File:** `coop.js` baris 56–70, `db_rpg.js` baris 471–487  
**Severity:** 🟡 MEDIUM — Tick status effect hanya bikin log teks, tidak ada `updateHp`

**Root Cause:**
Di `tickStatusEffects` (`db_rpg.js`), fungsi hanya return log string, tidak update HP di database.
Di `coop.js` baris 60–69, damage dari log di-extract & dikurangi dari `player.hp` (in-memory), tapi tidak di-save ke DB sebelum combat selesai.
Kecuali boss mati/kalah (baris 287–288), HP tidak di-sync. Kalau bot restart di tengah raid, HP tidak tersimpan.

---

### Bug #7 — Dungeon cooldown set saat ACCEPT, bukan selesai
**File:** `coop.js` baris 465–466  
**Severity:** 🟡 MEDIUM — Kalau dungeon abandon/disconnect, cooldown tetap aktif padahal tidak dapat reward

**Root Cause:**
```js
// Accept — set cooldown LANGSUNG saat mulai
setDungeonCooldown(invite.inviter);  // ← langsung saat accept!
setDungeonCooldown(userId);
```
Komentar di `clearRaidSession` (baris 323) malah bilang "Cooldown dungeon tidak aktif (dibatalkan)" — tapi cooldown tetap ada di DB, tidak di-reset.

**Fix:** Reset cooldown saat `clearRaidSession` dipanggil (abandoned), atau set cooldown hanya saat raid selesai (win/lose).

---

### Bug #8 — Burn status effect di-apply ke `boss.id` (string nama boss), bukan user_id yang benar
**File:** `coop.js` baris 113  
**Severity:** 🟡 MEDIUM — Burn effect pada boss tidak berfungsi karena ID salah

**Root Cause:**
```js
addStatusEffect(boss.id, 'burn', 3, Math.floor(dmg * 0.15));
// boss.id = 'kepala_goblin', 'ratu_laba', dsb.
```
`tickStatusEffects` kemudian query `status_effects WHERE user_id = boss.id` — ini akan return kosong karena boss bukan user DB. Log burn tidak pernah diproses dari boss.

---

## 🟢 BUG MINOR / UX

---

### Bug #9 — `/quest claim` bisa double-klaim jika race condition
**File:** `db_rpg.js` baris 551–568  
**Severity:** 🟢 LOW — Jarang terjadi tapi bisa dieksploitasi

Tidak ada `WHERE claimed = 0` di UPDATE statement, cek dilakukan secara terpisah sebelum UPDATE. Harus atomic.

**Fix:**
```js
// Ganti 2 query menjadi 1 atomic:
const result = db.prepare(
  'UPDATE quest_progress SET claimed = 1 WHERE id = ? AND claimed = 0'
).run(progress.id);
if (result.changes === 0) return { success: false, reason: 'sudah diklaim' };
```

---

### Bug #10 — `getFirstQueuedExcluding` tidak filter gender dengan benar
**File:** `db.js` baris 54–72  
**Severity:** 🟢 LOW — Matching gender kadang tidak akurat

**Root Cause:**
Query `stmtFirstMatchLang`:
```sql
AND (gender = ? OR ? = 'any')   -- param: userMatchGender, userMatchGender
AND (match_gender = ? OR match_gender = 'any')  -- param: userGender
```
Logika: "gender kandidat harus cocok dengan apa yang user mau (match_gender user), DAN match_gender kandidat harus 'any' atau cocok gender user."
Tapi tidak filter kandidat yang `is_banned = 1` dari stmtFirstMatchAny — wait, sudah ada. OK ini sebenarnya fine, hanya query parameter ordering perlu di-audit manual.

---

### Bug #11 — `/give` tidak kirim notifikasi jika partner tidak punya RPG character
**File:** `economy.js` baris 511  
**Severity:** 🟢 LOW — UX minor

```js
const partner = getOrCreateUser(partnerId);
if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG.');
```
Benar, tapi setelah transfer sukses di baris 534, `partner` bisa null jika `addGold(partnerId, received)` dipanggil untuk user yang tidak ada di `rpg_users`. Ini menyebabkan `addGold` silent fail (UPDATE tidak match, 0 rows changed).

---

## 📋 RINGKASAN PRIORITAS

| # | Bug | File | Severity | Effort |
|---|-----|------|----------|--------|
| 1 | `claimedCount` ReferenceError di `/quest` | index.js:365 | 🔴 Crash | 1 menit |
| 2 | `totalAtk/totalDef` undefined di `/party` | index.js:410 | 🔴 Crash | 2 menit |
| 5 | Shield check pakai classId bukan uid | coop.js:169 | 🟡 Game-breaking | 5 menit |
| 8 | Burn apply ke boss.id bukan uid DB | coop.js:113 | 🟡 Feature broken | 10 menit |
| 4 | `/profile` equipment pakai logika lama | profile.js:73 | 🟡 Display salah | 10 menit |
| 7 | Dungeon cooldown set saat accept bukan selesai | coop.js:465 | 🟡 UX rusak | 15 menit |
| 6 | Burn/bleed HP tidak update DB mid-raid | coop.js:60 | 🟡 Data loss | 20 menit |
| 3 | `/upgrade` staff/accessory tidak support | economy.js:385 | 🟡 UX | 5 menit |
| 9 | `/quest claim` race condition | db_rpg.js:554 | 🟢 Security | 5 menit |
| 11 | `/give` silent fail jika partner no RPG | economy.js:511 | 🟢 Minor | 5 menit |

---

## ✅ URUTAN FIX YANG DISARANKAN

1. **Fix #1 + #2 dulu** — crash paling parah, 1 commit
2. **Fix #5 + #8** — dungeon broken total, 1 commit  
3. **Fix #4** — display equipment salah, 1 commit
4. **Fix #7** — cooldown fairness, 1 commit
5. **Fix #6** — status effect HP sync, 1 commit
6. **Fix #3 + #9 + #11** — minor cleanup, 1 commit
