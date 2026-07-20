// src/rpg/help.js
// Panduan RPG — Discord game bot style, HTML, mobile-friendly
const { Markup } = require('telegraf');

const HELP_PAGES = [
  {
    id: 'intro',
    title: '📖 Panduan RPG — 1/12',
    text:
      `<b>⚔️ ANONYMOUS RPG</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Ngobrol anonim sambil main RPG! Progress-mu tersimpan walau ganti partner.\n\n` +
      `<b>🚀 Cara Mulai:</b>\n` +
      `1️⃣ Ketik /profile → buat karakter\n` +
      `2️⃣ Pilih kelas:\n` +
      `   ⚔️ <b>Ksatria</b> — Tank, Physical\n` +
      `   🔥 <b>Penyihir</b> — Magic DPS\n` +
      `   🗡️ <b>Pencuri</b> — Burst Crit\n` +
      `3️⃣ Grinding: /hunt /fish /mine\n` +
      `4️⃣ Dungeon bareng partner: /dungeon\n\n` +
      `<i>Ketik /help untuk semua commands</i>`,
    nav: [null, 'damage']
  },
  {
    id: 'damage',
    title: '📖 Panduan RPG — 2/12',
    text:
      `<b>⚔️ SISTEM DAMAGE</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>⚔️ Physical</b> (Ksatria &amp; Pencuri)\n` +
      `  • Dipengaruhi stat ATK\n` +
      `  • Dikurangi Physical Resist musuh\n\n` +
      `<b>🔮 Magic</b> (Penyihir)\n` +
      `  • Dipengaruhi stat Magic ATK\n` +
      `  • Dikurangi Magic Resist musuh\n\n` +
      `<b>💥 Crit System:</b>\n` +
      `  ⚔️ Ksatria : 5% → 1.5x dmg\n` +
      `  🔥 Penyihir: 10% → 1.8x dmg\n` +
      `  🗡️ Pencuri : 15% → 2.0x dmg\n\n` +
      `<b>🏰 Boss Resist:</b>\n` +
      `  🌿 Goblin    : Phys 20% · Magic 50%\n` +
      `  🕸️ Laba-laba : Phys 40% · Magic 20%\n` +
      `  🔥 Naga      : Phys 30% · Magic 30%\n` +
      `  💀 Raja      : Phys 25% · Magic 25%`,
    nav: ['intro', 'classes']
  },
  {
    id: 'classes',
    title: '📖 Panduan RPG — 3/12',
    text:
      `<b>🎭 DETAIL 3 KELAS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>⚔️ Ksatria</b>\n` +
      `  HP &amp; DEF tinggi, ATK sedang\n` +
      `  +15% Physical · -20% Magic\n` +
      `  Skill: <b>Tebasan Besar</b> (2.0x + 10% pen)\n\n` +
      `<b>🔥 Penyihir</b>\n` +
      `  Magic ATK tinggi, HP rendah\n` +
      `  +25% Magic · -30% Physical\n` +
      `  Skill: <b>Bola Api</b> (2.5x + Burn 3 turn)\n\n` +
      `<b>🗡️ Pencuri</b>\n` +
      `  Crit tinggi, burst cepat\n` +
      `  +20% Physical · Crit 2x lebih sering\n` +
      `  Skill: <b>Backstab</b> (3.0x + 100% Crit!)`,
    nav: ['damage', 'grinding']
  },
  {
    id: 'grinding',
    title: '📖 Panduan RPG — 4/12',
    text:
      `<b>⚡ ENERGI &amp; GRINDING</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Kamu punya <b>10 Energi</b>\n` +
      `Regen: +1 setiap <b>3 menit</b> otomatis\n\n` +
      `<b>📋 Commands:</b>\n` +
      `  /hunt — Berburu monster  <code>-2⚡</code>\n` +
      `  /fish — Mancing          <code>-1⚡</code>\n` +
      `  /mine — Menambang        <code>-3⚡</code>\n` +
      `  /daily — Hadiah harian   <code> 0⚡</code>\n\n` +
      `<b>🎁 Hasil Grinding:</b>\n` +
      `  • XP + Gold otomatis\n` +
      `  • Item loot (common → legendary)\n` +
      `  • Progress quest harian`,
    nav: ['classes', 'leveling']
  },
  {
    id: 'leveling',
    title: '📖 Panduan RPG — 5/12',
    text:
      `<b>📈 LEVELING &amp; STATS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📊 XP yang dibutuhkan:</b>\n` +
      `  Lv 1→2  : 40 XP\n` +
      `  Lv 5→6  : ~276 XP\n` +
      `  Lv 10→11: ~634 XP\n\n` +
      `<b>⬆️ Stats per Level:</b>\n` +
      `  ⚔️ Ksatria : +8 HP · +1.5 ATK · +2 DEF\n` +
      `  🔥 Penyihir: +5 HP · +2.5 Magic · +1 DEF\n` +
      `  🗡️ Pencuri : +6 HP · +2 ATK · +1.5 DEF\n\n` +
      `<b>❤️ Regen HP:</b>\n` +
      `  +10% MaxHP setiap 10 menit (otomatis)\n` +
      `  Atau pakai 🧪 Ramuan dari /inv`,
    nav: ['grinding', 'equipment']
  },
  {
    id: 'equipment',
    title: '📖 Panduan RPG — 6/12',
    text:
      `<b>🗡️ EQUIPMENT (4 SLOT)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Equipment harus dipasang manual via /equip\n\n` +
      `<b>Slot tersedia:</b>\n` +
      `  ⚔️ <b>Weapon</b>    — +ATK, +Crit Rate\n` +
      `  🪄 <b>Staff</b>     — +Magic ATK\n` +
      `  🛡️ <b>Armor</b>     — +DEF, +Magic Resist\n` +
      `  💍 <b>Accessory</b> — +Crit, +Resist\n\n` +
      `<b>📋 Commands:</b>\n` +
      `  /equip             — Lihat slot &amp; stats\n` +
      `  /equip [item]      — Pasang equipment\n` +
      `  /unequip [slot]    — Lepas equipment\n\n` +
      `<b>⬆️ Upgrade:</b>\n` +
      `  /upgrade [item] — +2 stat per tier\n` +
      `  Maks +5 · Butuh ore + Gold`,
    nav: ['leveling', 'economy']
  },
  {
    id: 'economy',
    title: '📖 Panduan RPG — 7/12',
    text:
      `<b>💰 EKONOMI &amp; CRAFTING</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📋 Commands:</b>\n` +
      `  /inv              — Inventaris\n` +
      `  /shop             — Toko item\n` +
      `  /buy [item/no]    — Beli item\n` +
      `  /sell [item/no]   — Jual item\n` +
      `  /use [item/no]    — Pakai item\n` +
      `  /craft            — Craft equipment\n` +
      `  /give [jumlah]    — Kirim gold (pajak 5%)\n\n` +
      `<b>🌟 Rarity:</b>\n` +
      `  ⚪ Common → 🟢 Uncommon → 🔵 Rare\n` +
      `  🟣 Epic → 🟠 Legendary\n\n` +
      `<i>Tip: /inv dulu sebelum /sell atau /use agar nomor item tersedia</i>`,
    nav: ['equipment', 'dungeon']
  },
  {
    id: 'dungeon',
    title: '📖 Panduan RPG — 8/12',
    text:
      `<b>🏰 DUNGEON RAID (Co-op)</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📋 Alur:</b>\n` +
      `  1. /dungeon → pilih tier dungeon\n` +
      `  2. Kirim undangan ke partner\n` +
      `  3. Partner terima → Raid mulai!\n` +
      `  4. Tiap turn: pilih aksi bersama\n\n` +
      `<b>⚡ Aksi per Turn:</b>\n` +
      `  🗡️ <b>Serang</b>   — Damage sesuai kelas\n` +
      `  🛡️ <b>Bertahan</b> — Damage -50%\n` +
      `  🔮 <b>Skill</b>    — Damage tinggi + efek\n` +
      `  🧪 <b>Item</b>     — Heal 15% HP\n\n` +
      `<b>👹 Mekanik Boss:</b>\n` +
      `  • Setiap 3 turn: serangan berat!\n` +
      `  • HP &lt; 50%: ENRAGE → ATK +30%!\n` +
      `  • Cooldown: 10 menit (setelah selesai)`,
    nav: ['economy', 'quest']
  },
  {
    id: 'quest',
    title: '📖 Panduan RPG — 9/12',
    text:
      `<b>📋 QUEST HARIAN</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📋 Commands:</b>\n` +
      `  /quest              — Lihat progress\n` +
      `  /quest claim [id]   — Klaim reward\n\n` +
      `<b>📝 10 Quest Harian:</b>\n` +
      `  🗡️ Pemburu Pemula   — Hunt 3x\n` +
      `  🎣 Pemancing Ulung  — Mancing 3x\n` +
      `  ⛏️ Penambang Rajin  — Mine 2x\n` +
      `  ⚒️ Tukang Crafts    — Craft 1x\n` +
      `  💰 Pedagang Kecil   — Jual 3x\n` +
      `  🏰 Penjelajah       — Dungeon 1x\n` +
      `  🤝 Dermawan         — Give gold 1x\n` +
      `  ⬆️ Upgrade Master   — Upgrade 1x\n` +
      `  🧪 Apoteker         — Use item 1x\n` +
      `  💬 Social Butterfly — Chat 10x\n\n` +
      `<i>Reset: Jam 00:00 WIB setiap hari</i>`,
    nav: ['dungeon', 'party']
  },
  {
    id: 'party',
    title: '📖 Panduan RPG — 10/12',
    text:
      `<b>👥 PARTY STATS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📋 Command:</b>\n` +
      `  /party — Lihat stats kamu + partner\n\n` +
      `<b>📊 Yang Ditampilkan:</b>\n` +
      `  • Level, HP, Gold kedua pemain\n` +
      `  • ATK, DEF, Magic ATK\n` +
      `  • Rata-rata level party\n` +
      `  • Total ATK &amp; DEF party\n\n` +
      `<b>💡 Tips Kombo:</b>\n` +
      `  ⚔️ + 🔥 Ksatria + Penyihir = Balanced\n` +
      `  🗡️ + 🔥 Pencuri + Penyihir = High Burst\n` +
      `  ⚔️ + 🗡️ Ksatria + Pencuri = Full Physical`,
    nav: ['quest', 'pvp']
  },
  {
    id: 'pvp',
    title: '📖 Panduan RPG — 11/12',
    text:
      `<b>⚔️ PVP DUEL</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>📋 Command:</b>\n` +
      `  /duel — Mulai duel dengan partner\n\n` +
      `<b>⚡ Mekanik:</b>\n` +
      `  • HP mulai 50% max (duel cepat)\n` +
      `  • Turn-based: Serang/Bertahan/Skill\n` +
      `  • Pertama HP = 0 → kalah!\n` +
      `  • Cooldown: 5 menit\n\n` +
      `<b>🏆 Reward:</b>\n` +
      `  🥇 Winner : +50 XP · +25g\n` +
      `  🥈 Loser  : +20 XP · +10g\n` +
      `  🔥 Streak 3x = +20% bonus reward!`,
    nav: ['party', 'shop']
  },
  {
    id: 'shop',
    title: '📖 Panduan RPG — 12/12',
    text:
      `<b>🏪 TOKO PETUALANG</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `<b>🧪 Consumables:</b>\n` +
      `  [1] Ramuan Kecil  — 15g  (Heal 15%)\n` +
      `  [2] Ramuan Besar  — 50g  (Heal 50%)\n` +
      `  [3] Ramuan Energi — 75g  (+3 energi)\n\n` +
      `<b>⚔️ Equipment:</b>\n` +
      `  [4] Kail Pancing+    — 200g\n` +
      `  [5] Beliung Tambang+ — 300g\n` +
      `  [6] Pedang Karatan   — 150g\n` +
      `  [7] Tongkat Ranting  — 80g\n` +
      `  [8] Jubah Terkutuk   — 200g\n` +
      `  [9] Cincin Perak     — 100g\n` +
      `  [10] Amulet Defence  — 150g\n\n` +
      `<i>Gunakan: /buy [nomor] atau /buy [nama]</i>`,
    nav: ['pvp', null]
  },
];

const PAGE_MAP = Object.fromEntries(HELP_PAGES.map(p => [p.id, p]));

function buildPageMessage(page) {
  const [prevId, nextId] = page.nav;
  const buttons = [];
  const row = [];
  if (prevId) row.push(Markup.button.callback('◀️ Sebelumnya', `help:page:${prevId}`));
  if (nextId) row.push(Markup.button.callback('Selanjutnya ▶️', `help:page:${nextId}`));
  if (row.length) buttons.push(row);
  buttons.push([Markup.button.callback('📋 Daftar Isi', 'help:index')]);

  return {
    text: `${page.title}\n\n${page.text}`,
    options: { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
  };
}

function buildIndexMessage() {
  const text =
    `<b>📖 PANDUAN RPG — DAFTAR ISI</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Pilih topik yang ingin dibaca:\n\n` +
    `1️⃣  Intro &amp; Cara Mulai\n` +
    `2️⃣  Sistem Damage\n` +
    `3️⃣  Detail 3 Kelas\n` +
    `4️⃣  Energi &amp; Grinding\n` +
    `5️⃣  Leveling &amp; Stats\n` +
    `6️⃣  Equipment (4 Slot)\n` +
    `7️⃣  Ekonomi &amp; Crafting\n` +
    `8️⃣  Dungeon Raid\n` +
    `9️⃣  Quest Harian\n` +
    `🔟  Party Stats\n` +
    `1️⃣1️⃣ PvP Duel\n` +
    `1️⃣2️⃣ Toko`;

  const buttons = [
    [Markup.button.callback('1️⃣ Intro', 'help:page:intro'), Markup.button.callback('2️⃣ Damage', 'help:page:damage')],
    [Markup.button.callback('3️⃣ Kelas', 'help:page:classes'), Markup.button.callback('4️⃣ Grinding', 'help:page:grinding')],
    [Markup.button.callback('5️⃣ Leveling', 'help:page:leveling'), Markup.button.callback('6️⃣ Equipment', 'help:page:equipment')],
    [Markup.button.callback('7️⃣ Economy', 'help:page:economy'), Markup.button.callback('8️⃣ Dungeon', 'help:page:dungeon')],
    [Markup.button.callback('9️⃣ Quest', 'help:page:quest'), Markup.button.callback('🔟 Party', 'help:page:party')],
    [Markup.button.callback('1️⃣1️⃣ PvP', 'help:page:pvp'), Markup.button.callback('1️⃣2️⃣ Toko', 'help:page:shop')],
  ];

  return { text, options: { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) } };
}

function setupHelp(bot, { rateLimitCommand }) {
  bot.command(['helprpg', 'rpghelp', 'bantuanrpg'], rateLimitCommand, (ctx) => {
    const { text, options } = buildIndexMessage();
    ctx.reply(text, options);
  });

  // Navigasi halaman — tanpa rate limit agar tidak muncul "tunggu X detik"
  bot.action(/^help:page:(\w+)$/, (ctx) => {
    const pageId = ctx.match[1];
    const page = PAGE_MAP[pageId];
    if (!page) return ctx.answerCbQuery('Halaman tidak ditemukan.', { show_alert: true });
    ctx.answerCbQuery();
    const { text, options } = buildPageMessage(page);
    ctx.editMessageText(text, options).catch(() => {});
  });

  bot.action('help:index', (ctx) => {
    ctx.answerCbQuery();
    const { text, options } = buildIndexMessage();
    ctx.editMessageText(text, options).catch(() => {});
  });
}

module.exports = { setupHelp };
