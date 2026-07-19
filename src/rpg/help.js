// src/rpg/help.js
// Panduan & tutorial lengkap sistem RPG dalam Bahasa Indonesia

const { Markup } = require('telegraf');

const HELP_PAGES = [
  // PAGE 1: Intro & Mulai
  {
    id: 'intro',
    title: '📖 Panduan RPG — Halaman 1/6',
    text:
      `<b>⚔️ Selamat Datang di Anonymous RPG! ⚔️</b>\n\n` +
      `Bot ini punya sistem RPG persisten ala Discord Bot — progressmu tidak akan hilang walau ganti partner!\n\n` +
      `<b>🚀 Cara Mulai:</b>\n` +
      `1️⃣ Ketik <code>/profile</code> untuk membuat karakter\n` +
      `2️⃣ Pilih salah satu dari 3 kelas:\n` +
      `   • <b>⚔️ Ksatria</b> — HP & DEF tinggi, cocok untuk pemula. Bonus: -10% damage di dungeon\n` +
      `   • <b>🔥 Penyihir</b> — ATK tinggi, HP rendah. Bonus: +15% XP dari /hunt\n` +
      `   • <b>🗡️ Pencuri</b> — Seimbang. Bonus: +gold seiring naik level\n\n` +
      `3️⃣ Mulai grinding untuk kumpulkan XP, Gold, dan Item!\n\n` +
      `<i>⚠️ Kelas tidak bisa diganti di versi ini. Pilih dengan bijak!</i>`,
    nav: [null, 'grinding']
  },

  // PAGE 2: Grinding
  {
    id: 'grinding',
    title: '📖 Panduan RPG — Halaman 2/6',
    text:
      `<b>⚡ Sistem Energi & Grinding</b>\n\n` +
      `Kamu punya <b>10 Energi</b> yang regen +1 setiap 5 menit.\n\n` +
      `<b>Aktivitas Grinding:</b>\n\n` +
      `🗡️ <code>/hunt</code> — Berburu monster (2 Energi)\n` +
      `   • Lawan monster sesuai levelmu\n` +
      `   • Dapat XP, Gold, dan loot acak\n` +
      `   • Kalah = HP berkurang, tidak dapat reward\n\n` +
      `🎣 <code>/fish</code> — Mancing (1 Energi)\n` +
      `   • Fokus dapat material & Gold\n` +
      `   • Tidak ada risiko kalah\n` +
      `   • Kadang dapat "Sepatu Bot Rusak" 😂\n\n` +
      `⛏️ <code>/mine</code> — Menambang (3 Energi)\n` +
      `   • Dapat ore untuk crafting\n` +
      `   • Hasil jual & craft paling tinggi\n` +
      `   • Ore langka = material equipment terbaik\n\n` +
      `🎁 <code>/daily</code> — Hadiah harian (0 Energi)\n` +
      `   • Cooldown 20 jam\n` +
      `   • Dapat: 30 Gold + 10 XP + 1 Ramuan Kecil`,
    nav: ['intro', 'leveling']
  },

  // PAGE 3: Leveling & Stats
  {
    id: 'leveling',
    title: '📖 Panduan RPG — Halaman 3/6',
    text:
      `<b>📈 Sistem Leveling & Stats</b>\n\n` +
      `<b>XP yang dibutuhkan:</b>\n` +
      `   Lv 1→2: 50 XP\n` +
      `   Lv 5→6: ~559 XP\n` +
      `   Lv 10→11: ~1.581 XP\n` +
      `   Lv 20→21: ~4.472 XP\n\n` +
      `<b>Stats naik per level:</b>\n` +
      `   • ⚔️ Ksatria: +8 MaxHP, +1.5 ATK, +2 DEF\n` +
      `   • 🔥 Penyihir: +5 MaxHP, +2.5 ATK, +1 DEF\n` +
      `   • 🗡️ Pencuri: +6 MaxHP, +2 ATK, +1.5 DEF\n\n` +
      `<b>❤️ Regenerasi HP:</b>\n` +
      `   +10% MaxHP setiap 10 menit (otomatis)\n` +
      `   Atau langsung penuh pakai Ramuan dari <code>/inv</code>\n\n` +
      `<b>📊 Cek progressmu:</b>\n` +
      `   <code>/profile</code> — Level, XP bar, HP, ATK, DEF, Gold, Energi, Tiket Dungeon`,
    nav: ['grinding', 'economy']
  },

  // PAGE 4: Economy (Inventory, Shop, Crafting)
  {
    id: 'economy',
    title: '📖 Panduan RPG — Halaman 4/6',
    text:
      `<b>💰 Ekonomi & Crafting</b>\n\n` +
      `<b>🎒 Inventaris:</b>\n` +
      `   <code>/inv</code> — Lihat semua item milikmu\n` +
      `   <code>/use ramuan_kecil</code> — Pakai item konsumable\n` +
      `   <code>/sell nama_item</code> — Jual item ke sistem\n\n` +
      `<b>🏪 Toko:</b>\n` +
      `   <code>/shop</code> — Lihat daftar item yang dijual\n` +
      `   <code>/buy ramuan_kecil</code> — Beli item (nama dengan underscore)\n` +
      `   Item toko: Ramuan Kecil (15g), Ramuan Besar (50g),\n` +
      `   Kail Pancing+ (200g), Beliung Tambang+ (300g)\n\n` +
      `<b>⚒️ Upgrade Equipment:</b>\n` +
      `   <code>/upgrade pedang_karatan</code> — Upgrade senjata/armor\n` +
      `   • Butuh ore material + Gold\n` +
      `   • Setiap upgrade: +2 ATK (senjata) atau +2 DEF (armor)\n` +
      `   • Maksimal upgrade: +5 tier\n\n` +
      `<b>🟠 Rarity Loot:</b>\n` +
      `   ⚪ Common → 🟢 Uncommon → 🔵 Rare → 🟣 Epic → 🟠 Legendary`,
    nav: ['leveling', 'dungeon']
  },

  // PAGE 5: Dungeon Co-op
  {
    id: 'dungeon',
    title: '📖 Panduan RPG — Halaman 5/6',
    text:
      `<b>🏰 Dungeon Raid (Co-op Eksklusif)</b>\n\n` +
      `Fitur terbaik bot ini! Hanya bisa dipakai saat kamu sedang terhubung dengan partner lewat <code>/search</code>.\n\n` +
      `<b>⏳ Cooldown Dungeon:</b>\n` +
      `   • Tidak ada batasan tiket harian!\n` +
      `   • Setiap selesai raid (menang/kalah), ada cooldown <b>10 menit</b> per pemain\n` +
      `   • Kedua pemain tidak boleh dalam status cooldown untuk mulai\n\n` +
      `<b>Kategori Dungeon (berdasarkan rata-rata level party):</b>\n` +
      `   🌿 Gua Goblin — Min. Lv 1 | Boss: Kepala Goblin\n` +
      `   🕸️ Sarang Laba-laba — Min. Lv 16 | Boss: Ratu Laba-laba\n` +
      `   🔥 Gua Naga Bayangan — Min. Lv 36 | Boss: Naga Bayangan\n` +
      `   💀 Istana Terkutuk — Min. Lv 61 | Boss: Raja Terkutuk\n\n` +
      `<b>Alur Raid:</b>\n` +
      `1. Ketik <code>/dungeon</code> → pilih kategori\n` +
      `2. Kirim undangan ke partner\n` +
      `3. Partner terima → Raid dimulai!\n` +
      `4. Tiap turn: pilih Serang / Bertahan / Skill / Item\n` +
      `5. Tunggu partner memilih → aksi dieksekusi bersama`,
    nav: ['economy', 'combat']
  },

  // PAGE 6: Combat & Tips
  {
    id: 'combat',
    title: '📖 Panduan RPG — Halaman 6/6',
    text:
      `<b>⚔️ Sistem Combat Dungeon & Tips</b>\n\n` +
      `<b>Aksi tiap turn:</b>\n` +
      `   🗡️ <b>Serang</b> — Damage normal ke boss\n` +
      `   🛡️ <b>Bertahan</b> — Kurangi damage diterima 50%\n` +
      `   🔮 <b>Skill</b> — Damage 1.8x ATK, cooldown 3 turn\n` +
      `   🧪 <b>Item</b> — Pakai ramuan, heal 15% MaxHP\n\n` +
      `<b>⚠️ Mekanik Khusus Boss:</b>\n` +
      `   • Setiap 3 turn, boss memperingatkan serangan berat → gunakan BERTAHAN!\n` +
      `   • Boss MENGAMUK (Enrage) saat HP &lt; 50% → ATK naik 30%!\n\n` +
      `<b>🏆 Reward Menang:</b>\n` +
      `   • XP & Gold dibagi rata ke KEDUA pemain\n` +
      `   • Drop Legendary (1 per raid, diacak siapa yang dapat)\n\n` +
      `<b>💔 Kalah:</b>\n` +
      `   • HP dipulihkan ke 20% MaxHP\n` +
      `   • Tidak dapat reward, tapi cooldown 10 menit tetap berlaku\n\n` +
      `<b>💰 Tips Gold:</b>\n` +
      `   <code>/give 100</code> — Kirim 100g ke partner (pajak 5%)\n` +
      `   Hanya bisa ke partner yang sedang paired!\n\n` +
      `<i>Selamat bertualang, Petualang! 🎮⚔️</i>`,
    nav: ['dungeon', null]
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
    `2️⃣ Energi & Grinding (/hunt, /fish, /mine)\n` +
    `3️⃣ Leveling, Stats & Regen HP\n` +
    `4️⃣ Ekonomi: Inventory, Shop, Upgrade\n` +
    `5️⃣ Dungeon Raid (Co-op)\n` +
    `6️⃣ Sistem Combat & Tips\n`;

  const buttons = [
    [Markup.button.callback('1️⃣ Intro & Cara Mulai',           'help:page:intro')],
    [Markup.button.callback('2️⃣ Energi & Grinding',            'help:page:grinding')],
    [Markup.button.callback('3️⃣ Leveling & Stats',             'help:page:leveling')],
    [Markup.button.callback('4️⃣ Ekonomi & Crafting',           'help:page:economy')],
    [Markup.button.callback('5️⃣ Dungeon Raid (Co-op)',         'help:page:dungeon')],
    [Markup.button.callback('6️⃣ Sistem Combat & Tips',         'help:page:combat')],
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
