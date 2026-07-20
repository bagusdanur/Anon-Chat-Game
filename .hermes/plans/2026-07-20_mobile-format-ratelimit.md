# Plan: Mobile-Friendly Format + Rate Limit Fix

---

## 🐛 Masalah yang Ditemukan

### Masalah 1 — Rate Limit salah konteks (PALING MENGGANGGU)
**File:** `src/middleware/rateLimit.js` baris 53

```js
function rateLimitCommand(ctx, next) {
  if (!checkCommandCooldown(chatId)) {
    return ctx.reply('Tunggu 2 detik sebelum mencari partner lagi.');
    // ↑ Pesan ini SELALU muncul untuk SEMUA command, termasuk /helprpg tombol "Selanjutnya"
  }
}
```

**Root cause:** `rateLimitCommand` dipakai di SEMUA command dan button action termasuk:
- `/helprpg` navigasi halaman (bukan "mencari partner")
- `/shop`, `/inv`, `/profile`, dll

Satu `commandCooldowns` map per `chatId` — artinya kalau user klik **"Selanjutnya"** di help, lalu dalam 2 detik klik lagi → dapat pesan "Tunggu 2 detik sebelum mencari partner lagi" padahal user tidak sedang cari partner sama sekali.

**Fix:**
1. Buat 2 fungsi terpisah: `rateLimitSearch` (hanya untuk `/search`, `/next`) dan `rateLimitCommand` (silent/skip, tidak reply)
2. Untuk help navigation: **hapus** `rateLimitCommand` — navigasi halaman tidak perlu cooldown
3. Pesan error harus kontekstual jika memang perlu cooldown

---

### Masalah 2 — Format tidak mobile-friendly

**Root cause analisis per file:**

#### `src/format.js` — `divider()` terlalu panjang
```js
function divider(char = '═', length = 30) {
  return char.repeat(30); // 30 karakter — di mobile 375px lebar ≈ 18-20 char per baris
}
// ═══════════════════════════════ → wrap di mobile → berantakan
```

#### `src/format.js` — `sectionHeader()` pakai `divider('─', 30)`
```js
function sectionHeader(title, emoji = '') {
  return `\n${prefix}**${title}**\n${divider('─', 30)}`; // 30 dash di bawah title
}
```
Di mobile layar kecil, 30 karakter `─` wrap ke baris baru → tampilan rusak.

#### `src/rpg/profile.js` — Tabel ASCII equipment **pasti rusak** di mobile
```js
msg += `┌─────────────────┬─────────────────┐\n`;
msg += `│ ⚔️ Weapon       │ 🪄 Staff        │\n`;
msg += `│ ${renderSlot(equipped.weapon).padEnd(15)} │ ${renderSlot(equipped.staff).padEnd(15)} │\n`;
```
`padEnd(15)` assumes monospace font. Telegram mobile **tidak** monospace → alignment hancur.
Emoji juga menyebabkan offset karena lebar karakter berbeda.

#### `index.js` — `/equip` command juga pakai tabel ASCII sama
```js
// index.js baris 484-490
msg += `┌─────────────────┬─────────────────┐\n`;
// ... tabel 2 kolom dengan padEnd(15)
```
Sama masalahnya.

#### `src/rpg/coop.js` — Combat UI pakai `**bold**` Markdown tapi reply pakai `parse_mode: 'Markdown'`
Telegraf `parse_mode: 'Markdown'` = Markdown v1 (legacy). `**bold**` tidak support di v1, harus `*bold*`.
Akibatnya: semua teks `**...**` di combat log tampil dengan literal asterisk `**BOSS MENGAMUK!**`

---

## ✅ Plan Fix — 4 Task

---

### Task 1 — Fix Rate Limit: pisah konteks + hapus dari navigasi help
**File:** `src/middleware/rateLimit.js`, `src/rpg/help.js`, `index.js`
**Effort:** ~10 menit

#### Step 1: Update `rateLimit.js` — tambah `rateLimitSearch` (khusus /search & /next)
```js
// COMMAND_COOLDOWN turunkan jadi 1s untuk UX lebih smooth di command biasa
const COMMAND_COOLDOWN = 2 * 1000; // tetap 2s
const SEARCH_COOLDOWN = 3 * 1000;  // 3s khusus search/next

// Map terpisah untuk search
const searchCooldowns = new Map();

function checkSearchCooldown(chatId) {
  const now = Date.now();
  const lastTime = searchCooldowns.get(chatId) || 0;
  if (now - lastTime < SEARCH_COOLDOWN) return false;
  searchCooldowns.set(chatId, now);
  return true;
}

// rateLimitCommand: silent skip (tidak reply), untuk command umum anti-spam
function rateLimitCommand(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();
  if (!checkCommandCooldown(chatId)) return; // silent — tidak reply
  return next();
}

// rateLimitSearch: reply dengan pesan kontekstual, khusus /search /next
function rateLimitSearch(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();
  if (!checkSearchCooldown(chatId)) {
    return ctx.reply('⏳ Tunggu sebentar sebelum mencari partner lagi.');
  }
  return next();
}
```

#### Step 2: Update `index.js` — pakai `rateLimitSearch` hanya di search/next
```js
// Import tambah rateLimitSearch
const { rateLimitMessage, rateLimitCommand, rateLimitSearch } = require('./src/middleware/rateLimit');

// Ganti di /search dan /next dan button action cmd_search, cmd_next:
bot.command('search', rateLimitSearch, handleSearch);
bot.command('next', rateLimitSearch, (ctx) => { ... });
bot.action('cmd_search', rateLimitSearch, (ctx) => { ... });
bot.action('cmd_next', rateLimitSearch, (ctx) => { ... });
```

#### Step 3: Update `help.js` — HAPUS `rateLimitCommand` dari navigasi
```js
// Sebelum:
bot.action(/^help:page:(\w+)$/, rateLimitCommand, (ctx) => { ... });
bot.action('help:index', rateLimitCommand, (ctx) => { ... });

// Sesudah: tidak ada rate limit di navigasi help
bot.action(/^help:page:(\w+)$/, (ctx) => { ... });
bot.action('help:index', (ctx) => { ... });
```

---

### Task 2 — Fix `format.js`: divider lebih pendek, mobile-safe
**File:** `src/format.js`
**Effort:** ~5 menit

```js
// Turunkan default length dari 30 → 20
// 20 karakter aman di mobile layar 320px+
function divider(char = '═', length = 20) {
  return char.repeat(length);
}

// sectionHeader: hapus divider bawah, pakai style berbeda
function sectionHeader(title, emoji = '') {
  const prefix = emoji ? `${emoji} ` : '';
  return `\n*── ${prefix}${title} ──*\n`; // lebih ringkas, tidak pakai divider 30 char
}
```

---

### Task 3 — Fix tabel ASCII equipment → layout list mobile-friendly
**File:** `src/rpg/profile.js`, `index.js`
**Effort:** ~15 menit

Ganti tabel 2-kolom ASCII dengan layout list vertikal (100% mobile-safe):

```
// SEBELUM (rusak di mobile):
┌─────────────────┬─────────────────┐
│ ⚔️ Weapon       │ 🪄 Staff        │
│ Pedang Karatan  │ (Kosong)        │
└─────────────────┴─────────────────┘

// SESUDAH (mobile-friendly):
🗡️ *Equipment:*

⚔️ Weapon: 🔵 Pedang Karatan +1
🪄 Staff: (Kosong)
🛡️ Armor: (Kosong)
💍 Accessory: 💍 Cincin Perak
```

Fungsi baru `renderEquipmentList(equipped)`:
```js
function renderEquipmentList(equipped) {
  const renderSlot = (item) => {
    if (!item) return '_(Kosong)_';
    const tier = item.upgrade_tier > 0 ? ` +${item.upgrade_tier}` : '';
    const rarity = RARITY_EMOJI[item.rarity] || '';
    return `${rarity} ${item.display_name}${tier}`;
  };
  let msg = '';
  msg += `⚔️ Weapon: ${renderSlot(equipped.weapon)}\n`;
  msg += `🪄 Staff: ${renderSlot(equipped.staff)}\n`;
  msg += `🛡️ Armor: ${renderSlot(equipped.armor)}\n`;
  msg += `💍 Accessory: ${renderSlot(equipped.accessory)}\n`;
  return msg;
}
```

---

### Task 4 — Fix parse_mode Markdown v1 di coop.js
**File:** `src/rpg/coop.js`, `src/rpg/help.js`, `src/rpg/profile.js`
**Effort:** ~10 menit

Ganti semua `**text**` → `*text*` di file yang pakai `parse_mode: 'Markdown'` (v1):

| File | Masalah |
|------|---------|
| `coop.js` | Semua combat log pakai `**bold**` → literal asterisk |
| `help.js` | Semua page text pakai `**bold**` |
| `profile.js` | `renderProfile` pakai `**Stats:**`, `**Equipment:**` |

Atau ganti `parse_mode: 'Markdown'` → `parse_mode: 'HTML'` dan pakai `<b>bold</b>` (lebih reliable).
**Rekomendasi: ganti ke HTML** karena lebih predictable, tidak ada escape issue.

---

## 📋 Urutan Eksekusi

1. **Task 1** — Rate limit fix (paling urgent, user frustrated)
2. **Task 3** — Equipment table → list (visual paling rusak)
3. **Task 4** — parse_mode Markdown v1 fix (bold tidak tampil)
4. **Task 2** — Divider length (minor, tapi cleanup)

## Files yang akan diubah:
- `src/middleware/rateLimit.js`
- `index.js` (import + /search, /next, cmd_search, cmd_next)
- `src/rpg/help.js` (hapus rateLimitCommand dari navigasi)
- `src/rpg/profile.js` (tabel → list, parse_mode fix)
- `index.js` (tabel equip → list)
- `src/format.js` (divider length, sectionHeader)
- `src/rpg/coop.js` (bold fix)
