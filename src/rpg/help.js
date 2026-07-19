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
    title: '📖 Panduan RPG — Halaman 8/8',
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
      `   • HP < 50%: ENRAGE → ATK +30%!\n` +
      `   • Cooldown 10 menit setelah raid selesai\n\n` +
      `<b>🏆 Tips:</b>\n` +
      `   • Pilih skill berdasarkan boss resistance!\n` +
      `   • Pencuri bagus lawan Goblin (Phys Resist rendah)\n` +
      `   • Penyihir bagus lawan Laba-laba (Magic Resist rendah)\n\n` +
      `<i>Selamat bertualang, Petualang! 🎮⚔️</i>`,
    nav: ['economy', null]
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
    `7️⃣ Ekonomi & Status Effects\n` +
    `8️⃣ Dungeon Raid & Tips`;

  const buttons = [
    [Markup.button.callback('1️⃣ Intro & Cara Mulai',           'help:page:intro')],
    [Markup.button.callback('2️⃣ Sistem Damage',               'help:page:damage')],
    [Markup.button.callback('3️⃣ Detail 3 Kelas',              'help:page:classes')],
    [Markup.button.callback('4️⃣ Energi & Grinding',            'help:page:grinding')],
    [Markup.button.callback('5️⃣ Leveling & Stats',             'help:page:leveling')],
    [Markup.button.callback('6️⃣ Equipment (4 Slot)',           'help:page:equipment')],
    [Markup.button.callback('7️⃣ Ekonomi & Status Effects',    'help:page:economy')],
    [Markup.button.callback('8️⃣ Dungeon Raid & Tips',         'help:page:dungeon')],
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
