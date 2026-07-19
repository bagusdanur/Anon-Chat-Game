// src/rpg/help.js
// Panduan & tutorial lengkap sistem RPG — Updated dengan Physical/Magic/Crit/Status/Resistance

const { Markup } = require('telegraf');

const HELP_PAGES = [
  // PAGE 1: Intro & Mulai
  {
    id: 'intro',
    title: '📖 Panduan RPG — Halaman 1/8',
    text:
      `<b>⚔️ Selamat Datang di Anonymous RPG! ⚔️</b>\n\n` +
      `Bot ini punya sistem RPG persisten ala Discord Bot — progressmu tidak akan hilang walau ganti partner!\n\n` +
      `<b>🚀 Cara Mulai:</b>\n` +
      `1️⃣ Ketik <code>/profile</code> untuk membuat karakter\n` +
      `2️⃣ Pilih salah satu dari 3 kelas:\n` +
      `   • <b>⚔️ Ksatria</b> — Physical fighter, HP & DEF tinggi. Skill: Tebasan Besar\n` +
      `   • <b>🔥 Penyihir</b> — Magic DPS, ATK magic tinggi. Skill: Bola Api + Burn\n` +
      `   • <b>🗡️ Pencuri</b> — Physical burst, Crit tinggi. Skill: Backstab (100% Crit!)\n\n` +
      `3️⃣ Mulai grinding untuk kumpulkan XP, Gold, dan Item!\n\n` +
      `<i>⚠️ Kelas tidak bisa diganti di versi ini. Pilih dengan bijak!</i>`,
    nav: [null, 'damage']
  },

  // PAGE 2: Damage System (BARU!)
  {
    id: 'damage',
    title: '📖 Panduan RPG — Halaman 2/8',
    text:
      `<b>⚔️ Sistem Damage: Physical vs Magic</b>\n\n` +
      `Setiap kelas punya tipe damage yang berbeda!\n\n` +
      `<b>⚔️ Physical Damage (Ksatria & Pencuri):</b>\n` +
      `   • Dipengaruhi stat ATK\n` +
      `   • Dikurangi Physical Resist musuh\n` +
      `   • Cocok lawan boss dengan Magic Resist tinggi\n\n` +
      `<b>🔮 Magic Damage (Penyihir):</b>\n` +
      `   • Dipengaruhi stat Magic ATK\n` +
      `   • Dikurangi Magic Resist musuh\n` +
      `   • Cocok lawan boss dengan Physical Resist tinggi\n\n` +
      `<b>💥 Crit System:</b>\n` +
      `   • Ksatria: 5% + 0.5%/level, multiplier 1.5x\n` +
      `   • Penyihir: 10% + 1%/level, multiplier 1.8x\n` +
      `   • Pencuri: 15% + 1.5%/level, multiplier 2.0x\n\n` +
      `<b>🛡️ Boss Resistances:</b>\n` +
      `   🌿 Kepala Goblin: Phys 20%, Magic 50% → Physical lebih efektif\n` +
      `   🕸️ Ratu Laba-laba: Phys 40%, Magic 20% → Magic lebih efektif\n` +
      `   🔥 Naga Bayangan: Phys 30%, Magic 30% → Seimbang\n` +
      `   💀 Raja Terkutuk: Phys 25%, Magic 25% → Seimbang`,
    nav: ['intro', 'classes']
  },

  // PAGE 3: Classes Detail (BARU!)
  {
    id: 'classes',
    title: '📖 Panduan RPG — Halaman 3/8',
    text:
      `<b>🎭 Detail 3 Kelas</b>\n\n` +
      `<b>⚔️ Ksatria — Physical Tank</b>\n` +
      `   Stats: HP tinggi, DEF tinggi, ATK sedang\n` +
      `   Bonus: +15% Physical Damage, -20% Magic\n` +
      `   Skill: <b>Tebasan Besar</b> (2.0x Phys + 10% DEF penetrate)\n` +
      `   Tips: Cocok untuk pemula, tahan damage boss\n\n` +
      `<b>🔥 Penyihir — Magic DPS</b>\n` +
      `   Stats: Magic ATK tinggi, HP rendah, DEF rendah\n` +
      `   Bonus: +25% Magic Damage, -30% Physical\n` +
      `   Skill: <b>Bola Api</b> (2.5x Magic + Burn 3 turn)\n` +
      `   Tips: Damage tinggi tapi rapuh, jaga jarak!\n\n` +
      `<b>🗡️ Pencuri — Physical Burst</b>\n` +
      `   Stats: ATK sedang, Crit Rate tinggi\n` +
      `   Bonus: +20% Physical Damage, 2x Crit Rate\n` +
      `   Skill: <b>Backstab</b> (3.0x Phys + 100% Crit!)\n` +
      `   Tips: Burst damage paling tinggi, cocok untuk speedrun`,
    nav: ['damage', 'grinding']
  },

  // PAGE 4: Grinding
  {
    id: 'grinding',
    title: '📖 Panduan RPG — Halaman 4/8',
    text:
      `<b>⚡ Sistem Energi & Grinding</b>\n\n` +
      `Kamu punya <b>10 Energi</b> yang regen +1 setiap 3 menit.\n\n` +
      `<b>Aktivitas Grinding:</b>\n\n` +
      `🗡️ <code>/hunt</code> — Berburu monster (2 Energi)\n` +
      `   • Lawan monster sesuai levelmu\n` +
      `   • Dapat XP, Gold, dan loot acak\n` +
      `   • Kalah = HP berkurang, tidak dapat reward\n\n` +
      `🎣 <code>/fish</code> — Mancing (1 Energi)\n` +
      `   • Fokus dapat material & Gold\n` +
      `   • Tidak ada risiko kalah\n\n` +
      `⛏️ <code>/mine</code> — Menambang (3 Energi)\n` +
      `   • Dapat ore untuk crafting\n` +
      `   • Hasil jual & craft paling tinggi\n\n` +
      `🎁 <code>/daily</code> — Hadiah harian (0 Energi)\n` +
      `   • Cooldown 20 jam\n` +
      `   • Dapat: 30 Gold + 10 XP + 1 Ramuan Kecil`,
    nav: ['classes', 'leveling']
  },

  // PAGE 5: Leveling & Stats
  {
    id: 'leveling',
    title: '📖 Panduan RPG — Halaman 5/8',
    text:
      `<b>📈 Sistem Leveling & Stats</b>\n\n` +
      `<b>XP yang dibutuhkan:</b>\n` +
      `   Lv 1→2: 50 XP\n` +
      `   Lv 5→6: ~559 XP\n` +
      `   Lv 10→11: ~1.581 XP\n` +
      `   Lv 20→21: ~4.472 XP\n\n` +
      `<b>Stats naik per level:</b>\n` +
      `   • ⚔️ Ksatria: +8 HP, +1.5 ATK, +2 DEF, +0.5% Crit\n` +
      `   • 🔥 Penyihir: +5 HP, +2.5 Magic ATK, +1 DEF, +1% Crit\n` +
      `   • 🗡️ Pencuri: +6 HP, +2 ATK, +1.5 DEF, +1.5% Crit\n\n` +
      `<b>❤️ Regenerasi HP:</b>\n` +
      `   +10% MaxHP setiap 10 menit (otomatis)\n` +
      `   Atau langsung penuh pakai Ramuan dari <code>/inv</code>\n\n` +
      `<b>📊 Cek progressmu:</b>\n` +
      `   <code>/profile</code> — Level, XP, HP, ATK, DEF, Magic ATK, Crit, Resist`,
    nav: ['grinding', 'equipment']
  },

  // PAGE 6: Equipment (BARU!)
  {
    id: 'equipment',
    title: '📖 Panduan RPG — Halaman 6/8',
    text:
      `<b>🗡️ Sistem Equipment (4 Slot)</b>\n\n` +
      `Equipment otomatis dipakai dari inventory terbaik per slot!\n\n` +
      `<b>⚔️ Weapon Slot:</b>\n` +
      `   Bonus: +ATK, +Crit Rate\n` +
      `   Contoh: Pedang Karatan (+2 ATK, +5% Crit)\n\n` +
      `<b>🪄 Staff Slot:</b>\n` +
      `   Bonus: +Magic ATK, +Crit Rate\n` +
      `   Contoh: Tongkat Api (+6 Magic ATK, +8% Crit)\n\n` +
      `<b>🛡️ Armor Slot:</b>\n` +
      `   Bonus: +DEF, +Magic Resist\n` +
      `   Contoh: Jubah Terkutuk (+5 DEF, +10% Magic Resist)\n\n` +
      `<b>💍 Accessory Slot:</b>\n` +
      `   Bonus: +Crit, +Resist, +ATK/Magic ATK\n` +
      `   Contoh: Mahkota Terkutuk (+5 ATK, +5 Magic ATK, +10% Crit)\n\n` +
      `<b>⬆️ Upgrade Equipment:</b>\n` +
      `   <code>/upgrade nama_item</code> — +2 stat per tier (maks +5)\n` +
      `   Butuh ore material + Gold`,
    nav: ['leveling', 'economy']
  },

  // PAGE 7: Economy
  {
    id: 'economy',
    title: '📖 Panduan RPG — Halaman 7/8',
    text:
      `<b>💰 Ekonomi & Inventory</b>\n\n` +
      `<b>🎒 Commands:</b>\n` +
      `   <code>/inv</code> — Lihat semua item\n` +
      `   <code>/use ramuan_kecil</code> — Pakai consumable\n` +
      `   <code>/sell nama_item</code> — Jual item\n` +
      `   <code>/shop</code> — Lihat toko\n` +
      `   <code>/buy nama_item</code> — Beli item\n` +
      `   <code>/give 100</code> — Kirim gold ke partner (pajak 5%)\n\n` +
      `<b>⚒️ Crafting (BARU!):</b>\n` +
      `   <code>/craft</code> — Lihat semua resep\n` +
      `   <code>/craft [nomor]</code> — Craft item (contoh: /craft 1)\n` +
      `   <code>/craft [nama]</code> — Craft by name (contoh: /craft pedang besi)\n\n` +
      `<b>🗡️ Contoh Resep:</b>\n` +
      `   🗡️ Pedang Besi — 5 Besi + 3 Tembaga + 100g\n` +
      `   🔥 Tongkat Api — 8 Batu Bara + 3 Perak + 150g\n` +
      `   🛡️ Perisai Besi — 8 Besi + 5 Kulit + 120g\n` +
      `   🐉 Pedang Naga — 10 Besi + 5 Fragmen Naga + 500g\n\n` +
      `<b>🟠 Rarity:</b>\n` +
      `   ⚪ Common → 🟢 Uncommon → 🔵 Rare → 🟣 Epic → 🟠 Legendary\n\n` +
      `<b>💫 Status Effects (Dungeon):</b>\n` +
      `   🔥 Burn — 5% HP/t selama 3 turn (dari Penyihir)\n` +
      `   ⚡ Stun — Skip 1 turn\n` +
      `   🛡️ Shield — -50% damage 1 turn (dari Bertahan)`,
    nav: ['equipment', 'dungeon']
  },

  // PAGE 8: Dungeon & Tips
  {
    id: 'dungeon',
    title: '📖 Panduan RPG — Halaman 8/10',
    text:
      `<b>🏰 Dungeon Raid (Co-op)</b>\n\n` +
      `<b>Alur:</b>\n` +
      `1. <code>/dungeon</code> → pilih tier\n` +
      `2. Kirim undangan ke partner\n` +
      `3. Partner terima → Raid dimulai!\n` +
      `4. Tiap turn: pilih aksi\n` +
      `5. Tunggu partner → aksi dieksekusi\n\n` +
      `<b>Aksi:</b>\n` +
      `   🗡️ Serang — Damage sesuai tipe kelas\n` +
      `   🛡️ Bertahan — -50% damage + Shield\n` +
      `   🔮 Skill — Damage tinggi + efek khusus\n` +
      `   🧪 Item — Heal 15% HP + bersihkan debuff\n\n` +
      `<b>⚠️ Boss Mechanics:</b>\n` +
      `   • Setiap 3 turn: serangan berat → BERTAHAN!\n` +
      `   • HP &lt; 50%: ENRAGE → ATK +30%!\n` +
      `   • Cooldown 10 menit setelah raid selesai\n\n` +
      `<b>🏆 Tips:</b>\n` +
      `   • Pilih skill berdasarkan boss resistance!\n` +
      `   • Pencuri bagus lawan Goblin (Phys Resist rendah)\n` +
      `   • Penyihir bagus lawan Laba-laba (Magic Resist rendah)`,
    nav: ['economy', 'quest']
  },

  // PAGE 9: Quest System (BARU!)
  {
    id: 'quest',
    title: '📖 Panduan RPG — Halaman 9/10',
    text:
      `<b>📋 Quest Harian</b>\n\n` +
      `Dapatkan reward tambahan dengan menyelesaikan quest harian!\n\n` +
      `<b>Commands:</b>\n` +
      `   <code>/quest</code> — Lihat semua quest & progress\n` +
      `   <code>/quest claim [id]</code> — Klaim reward\n\n` +
      `<b>10 Quest Harian:</b>\n` +
      `   🗡️ Pemburu Pemula — Hunt 3x (50xp + 30g)\n` +
      `   🎣 Pemancing Ulung — Mancing 3x (40xp + 25g)\n` +
      `   ⛏️ Penambang Rajin — Mine 2x (60xp + 35g)\n` +
      `   ⚒️ Tukang Crafts — Craft 1x (40xp + 20g)\n` +
      `   💰 Pedagang Kecil — Jual 3x (30xp + 40g)\n` +
      `   🏰 Penjelajah Dungeon — Dungeon 1x (100xp + 50g + Ramuan)\n` +
      `   🤝 Dermawan — Give gold 1x (30xp + 15g)\n` +
      `   ⬆️ Upgrade Master — Upgrade 1x (50xp + 25g)\n` +
      `   🧪 Apoteker — Use item 1x (20xp + 10g)\n` +
      `   💬 Social Butterfly — Chat 10x (30xp + 20g)\n\n` +
      `<b>⏰ Reset:</b> Jam 00:00 (UTC+7) setiap hari`,
    nav: ['dungeon', 'party']
  },

  // PAGE 10: Party Stats (BARU!)
  {
    id: 'party',
    title: '📖 Panduan RPG — Halaman 10/10',
    text:
      `<b>👥 Party Stats</b>\n\n` +
      `Lihat stats lengkap kamu dan partner!\n\n` +
      `<b>Command:</b>\n` +
      `   <code>/party</code> — Tampilkan stats party\n\n` +
      `<b>Yang Ditampilkan:</b>\n` +
      `   • Level, HP, ATK, DEF kedua pemain\n` +
      `   • Magic ATK, Crit Rate, Gold\n` +
      `   • Avg Level party\n` +
      `   • Total ATK & DEF party\n\n` +
      `<b>💡 Tips:</b>\n` +
      `   • Gunakan <code>/party</code> sebelum dungeon\n` +
      `   • Pastikan stats seimbang\n` +
      `   • Kombinasi Ksatria + Penyihir = Physical + Magic\n` +
      `   • Kombinasi Pencuri + Penyihir = High Crit + Magic\n\n` +
      `<i>Selamat bertualang, Petualang! 🎮⚔️</i>`,
    nav: ['quest', 'pvp']
  },

  // PAGE 11: PvP Duel (BARU!)
  {
    id: 'pvp',
    title: '📖 Panduan RPG — Halaman 11/12',
    text:
      `<b>⚔️ PvP Duel</b>\n\n` +
      `Battle 1v1 dengan partner!\n\n` +
      `<b>Command:</b>\n` +
      `   <code>/duel</code> — Mulai duel dengan partner\n\n` +
      `<b>Mekanik:</b>\n` +
      `   • HP = 50% max HP (duel cepat)\n` +
      `   • Turn-based: pilih Serang / Bertahan / Skill\n` +
      `   • Pertama HP = 0 → kalah!\n` +
      `   • Cooldown 5 menit setelah duel selesai\n\n` +
      `<b>💰 Reward:</b>\n` +
      `   • Winner: 50 XP + 25g\n` +
      `   • Loser: 20 XP + 10g\n` +
      `   • Draw: 25 XP + 10g (kedua pemain)\n\n` +
      `<b>🔥 Win Streak:</b>\n` +
      `   • 3 win berturut = +20% reward bonus!\n` +
      `   • Streak reset kalau kalah`,
    nav: ['party', 'shop']
  },

  // PAGE 12: Shop Expanded (BARU!)
  {
    id: 'shop',
    title: '📖 Panduan RPG — Halaman 12/12',
    text:
      `<b>🏪 Toko (Expanded)</b>\n\n` +
      `<b>Commands:</b>\n` +
      `   <code>/shop</code> — Lihat semua item\n` +
      `   <code>/buy [nomor]</code> — Beli item\n\n` +
      `<b>📋 Item Tersedia:</b>\n\n` +
      `<b>🧪 Consumables:</b>\n` +
      `   [1] Ramuan Kecil — 15g (Heal 15% HP)\n` +
      `   [2] Ramuan Besar — 50g (Heal 50% HP)\n` +
      `   [3] Ramuan Energi — 75g (+3 Energi) 🆕\n\n` +
      `<b>⛏️ Tools:</b>\n` +
      `   [4] Kail Pancing+ — 200g\n` +
      `   [5] Beliung Tambang+ — 300g\n\n` +
      `<b>⚔️ Equipment:</b>\n` +
      `   [6] Pedang Karatan — 150g (ATK+2, Crit+5%)\n` +
      `   [7] Tongkat Ranting — 80g (Magic ATK+3)\n` +
      `   [8] Jubah Terkutuk — 200g (DEF+5, MagicRes+10%)\n` +
      `   [9] Cincin Perak — 100g (Crit+5%)\n` +
      `   [10] Amulet Pertahanan — 150g (DEF+3, Resist+5%) 🆕\n\n` +
      `<b>💡 Tip:</b> Equipment bisa di-upgrade dengan <code>/upgrade</code>!`,
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
    `<b>📖 Panduan RPG — Daftar Isi</b>\n\n` +
    `Pilih topik yang ingin kamu baca:\n\n` +
    `1️⃣ Intro & Cara Mulai\n` +
    `2️⃣ Sistem Damage (Physical vs Magic)\n` +
    `3️⃣ Detail 3 Kelas\n` +
    `4️⃣ Energi & Grinding\n` +
    `5️⃣ Leveling & Stats\n` +
    `6️⃣ Equipment (4 Slot)\n` +
    `7️⃣ Ekonomi, Crafting & Status Effects\n` +
    `8️⃣ Dungeon Raid & Tips\n` +
    `9️⃣ Quest Harian\n` +
    `🔟 Party Stats\n` +
    `1️⃣1️⃣ PvP Duel\n` +
    `1️⃣2️⃣ Toko (Expanded)`;

  const buttons = [
    [Markup.button.callback('1️⃣ Intro & Cara Mulai',           'help:page:intro')],
    [Markup.button.callback('2️⃣ Sistem Damage',               'help:page:damage')],
    [Markup.button.callback('3️⃣ Detail 3 Kelas',              'help:page:classes')],
    [Markup.button.callback('4️⃣ Energi & Grinding',            'help:page:grinding')],
    [Markup.button.callback('5️⃣ Leveling & Stats',             'help:page:leveling')],
    [Markup.button.callback('6️⃣ Equipment (4 Slot)',           'help:page:equipment')],
    [Markup.button.callback('7️⃣ Ekonomi & Crafting',          'help:page:economy')],
    [Markup.button.callback('8️⃣ Dungeon Raid & Tips',         'help:page:dungeon')],
    [Markup.button.callback('9️⃣ Quest Harian',                'help:page:quest')],
    [Markup.button.callback('🔟 Party Stats',                  'help:page:party')],
    [Markup.button.callback('1️⃣1️⃣ PvP Duel',                  'help:page:pvp')],
    [Markup.button.callback('1️⃣2️⃣ Toko (Expanded)',           'help:page:shop')],
  ];

  return {
    text,
    options: { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) }
  };
}

function setupHelp(bot, { rateLimitCommand }) {
  // Command entry point
  bot.command(['helprpg', 'rpghelp', 'bantuanrpg'], rateLimitCommand, (ctx) => {
    const { text, options } = buildIndexMessage();
    ctx.reply(text, options);
  });

  // Navigation: halaman spesifik
  bot.action(/^help:page:(\w+)$/, rateLimitCommand, (ctx) => {
    const pageId = ctx.match[1];
    const page = PAGE_MAP[pageId];
    if (!page) return ctx.answerCbQuery('Halaman tidak ditemukan.', { show_alert: true });
    ctx.answerCbQuery();
    const { text, options } = buildPageMessage(page);
    ctx.editMessageText(text, options).catch(() => {});
  });

  // Kembali ke daftar isi
  bot.action('help:index', rateLimitCommand, (ctx) => {
    ctx.answerCbQuery();
    const { text, options } = buildIndexMessage();
    ctx.editMessageText(text, options).catch(() => {});
  });
}

module.exports = { setupHelp };
