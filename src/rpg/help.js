// src/rpg/help.js
// Panduan & tutorial lengkap sistem RPG — Clean Layout

const { Markup } = require('telegraf');
const { divider, sectionHeader, commandList, bulletList, kvPair } = require('../format');

const HELP_PAGES = [
  // PAGE 1: Intro
  {
    id: 'intro',
    title: '📖 Panduan RPG — 1/12',
    text:
      `${divider('═', 30)}\n` +
      `**⚔️ ANONYMOUS RPG**\n` +
      `${divider('═', 30)}\n\n` +
      `Selamat datang di Anonymous RPG!\n` +
      `Progressmu tidak akan hilang walau ganti partner.\n\n` +
      `${sectionHeader('🚀 Cara Mulai')}` +
      `1. Ketik \`/profile\` untuk membuat karakter\n` +
      `2. Pilih salah satu dari 3 kelas:\n` +
      `   ⚔️ **Ksatria** — Physical fighter\n` +
      `   🔥 **Penyihir** — Magic DPS\n` +
      `   🗡️ **Pencuri** — Physical burst\n\n` +
      `3. Mulai grinding dengan \`/hunt\`, \`/fish\`, \`/mine\`\n\n` +
      `_Ketik /help untuk lihat semua commands_`,
    nav: [null, 'damage']
  },

  // PAGE 2: Damage System
  {
    id: 'damage',
    title: '📖 Panduan RPG — 2/12',
    text:
      `${divider('═', 30)}\n` +
      `**⚔️ SISTEM DAMAGE**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Physical vs Magic')}` +
      `**⚔️ Physical** (Ksatria & Pencuri)\n` +
      `   • Dipengaruhi stat ATK\n` +
      `   • Dikurangi Physical Resist\n\n` +
      `**🔮 Magic** (Penyihir)\n` +
      `   • Dipengaruhi stat Magic ATK\n` +
      `   • Dikurangi Magic Resist\n\n` +
      `${sectionHeader('Crit System')}` +
      `   Ksatria: 5% + 0.5%/lvl → 1.5x\n` +
      `   Penyihir: 10% + 1%/lvl → 1.8x\n` +
      `   Pencuri: 15% + 1.5%/lvl → 2.0x\n\n` +
      `${sectionHeader('Boss Resistances')}` +
      `   🌿 Goblin: Phys 20%, Magic 50%\n` +
      `   🕸️ Laba-laba: Phys 40%, Magic 20%\n` +
      `   🔥 Naga: Phys 30%, Magic 30%\n` +
      `   💀 Raja: Phys 25%, Magic 25%`,
    nav: ['intro', 'classes']
  },

  // PAGE 3: Classes
  {
    id: 'classes',
    title: '📖 Panduan RPG — 3/12',
    text:
      `${divider('═', 30)}\n` +
      `**🎭 DETAIL 3 KELAS**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('⚔️ Ksatria', '')}` +
      `HP tinggi, DEF tinggi, ATK sedang\n` +
      `Bonus: +15% Physical, -20% Magic\n` +
      `Skill: **Tebasan Besar** (2.0x + 10% pen)\n\n` +
      `${sectionHeader('🔥 Penyihir', '')}` +
      `Magic ATK tinggi, HP rendah\n` +
      `Bonus: +25% Magic, -30% Physical\n` +
      `Skill: **Bola Api** (2.5x + Burn 3 turn)\n\n` +
      `${sectionHeader('🗡️ Pencuri', '')}` +
      `ATK sedang, Crit tinggi\n` +
      `Bonus: +20% Physical, 2x Crit Rate\n` +
      `Skill: **Backstab** (3.0x + 100% Crit!)`,
    nav: ['damage', 'grinding']
  },

  // PAGE 4: Grinding
  {
    id: 'grinding',
    title: '📖 Panduan RPG — 4/12',
    text:
      `${divider('═', 30)}\n` +
      `**⚡ ENERGI & GRINDING**\n` +
      `${divider('═', 30)}\n\n` +
      `Kamu punya **10 Energi** (regen +1/3 menit)\n\n` +
      `${sectionHeader('Commands')}` +
      `\`/hunt\` — Berburu monster (2 energi)\n` +
      `\`/fish\` — Mancing (1 energi)\n` +
      `\`/mine\` — Menambang (3 energi)\n` +
      `\`/daily\` — Hadiah harian (0 energi)`,
    nav: ['classes', 'leveling']
  },

  // PAGE 5: Leveling
  {
    id: 'leveling',
    title: '📖 Panduan RPG — 5/12',
    text:
      `${divider('═', 30)}\n` +
      `**📈 LEVELING & STATS**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('XP Required')}` +
      `Lv 1→2: 50 XP\n` +
      `Lv 5→6: ~559 XP\n` +
      `Lv 10→11: ~1,581 XP\n\n` +
      `${sectionHeader('Stats per Level')}` +
      `⚔️ Ksatria: +8 HP, +1.5 ATK, +2 DEF\n` +
      `🔥 Penyihir: +5 HP, +2.5 Magic, +1 DEF\n` +
      `🗡️ Pencuri: +6 HP, +2 ATK, +1.5 DEF\n\n` +
      `${sectionHeader('Regen HP')}` +
      `+10% MaxHP setiap 10 menit (otomatis)\n` +
      `Atau pakai Ramuan dari \`/inv\``,
    nav: ['grinding', 'equipment']
  },

  // PAGE 6: Equipment
  {
    id: 'equipment',
    title: '📖 Panduan RPG — 6/12',
    text:
      `${divider('═', 30)}\n` +
      `**🗡️ EQUIPMENT (4 SLOT)**\n` +
      `${divider('═', 30)}\n\n` +
      `Equipment otomatis dipakai dari inventory:\n\n` +
      `${kvPair('⚔️', 'Weapon', '+ATK, +Crit Rate')}
` +
      `${kvPair('🪄', 'Staff', '+Magic ATK')}
` +
      `${kvPair('🛡️', 'Armor', '+DEF, +Magic Resist')}
` +
      `${kvPair('💍', 'Accessory', '+Crit, +Resist')}
\n` +
      `${sectionHeader('Upgrade')}` +
      `\`/upgrade [item]\` — +2 stat per tier\n` +
      `Maksimal: +5 tier\n` +
      `Butuh: ore material + Gold`,
    nav: ['leveling', 'economy']
  },

  // PAGE 7: Economy
  {
    id: 'economy',
    title: '📖 Panduan RPG — 7/12',
    text:
      `${divider('═', 30)}\n` +
      `**💰 EKONOMI & CRAFTING**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Commands')}` +
      `\`/inv\` — Inventaris\n` +
      `\`/shop\` — Toko\n` +
      `\`/buy [item]\` — Beli item\n` +
      `\`/sell [item]\` — Jual item\n` +
      `\`/use [item]\` — Pakai item\n` +
      `\`/craft\` — Craft equipment\n` +
      `\`/give [jumlah]\` — Kirim gold (pajak 5%)\n\n` +
      `${sectionHeader('Rarity')}` +
      `⚪ Common → 🟢 Uncommon → 🔵 Rare\n` +
      `🟣 Epic → 🟠 Legendary`,
    nav: ['equipment', 'dungeon']
  },

  // PAGE 8: Dungeon
  {
    id: 'dungeon',
    title: '📖 Panduan RPG — 8/12',
    text:
      `${divider('═', 30)}\n` +
      `**🏰 DUNGEON RAID (Co-op)**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Alur')}` +
      `1. \`/dungeon\` → pilih tier\n` +
      `2. Kirim undangan ke partner\n` +
      `3. Partner terima → Raid mulai!\n` +
      `4. Tiap turn: pilih aksi\n\n` +
      `${sectionHeader('Aksi')}` +
      `🗡️ Serang — Damage sesuai kelas\n` +
      `🛡️ Bertahan — -50% damage\n` +
      `🔮 Skill — Damage tinggi + efek\n` +
      `🧪 Item — Heal 15% HP\n\n` +
      `${sectionHeader('Boss')}` +
      `• Setiap 3 turn: serangan berat!\n` +
      `• HP < 50%: ENRAGE → ATK +30%!\n` +
      `• Cooldown: 10 menit`,
    nav: ['economy', 'quest']
  },

  // PAGE 9: Quest
  {
    id: 'quest',
    title: '📖 Panduan RPG — 9/12',
    text:
      `${divider('═', 30)}\n` +
      `**📋 QUEST HARIAN**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Commands')}` +
      `\`/quest\` — Lihat quest & progress\n` +
      `\`/quest claim [id]\` — Klaim reward\n\n` +
      `${sectionHeader('10 Quest')}` +
      `🗡️ Pemburu Pemula — Hunt 3x\n` +
      `🎣 Pemancing Ulung — Mancing 3x\n` +
      `⛏️ Penambang Rajin — Mine 2x\n` +
      `⚒️ Tukang Crafts — Craft 1x\n` +
      `💰 Pedagang Kecil — Jual 3x\n` +
      `🏰 Penjelajah — Dungeon 1x\n` +
      `🤝 Dermawan — Give gold 1x\n` +
      `⬆️ Upgrade Master — Upgrade 1x\n` +
      `🧪 Apoteker — Use item 1x\n` +
      `💬 Social Butterfly — Chat 10x\n\n` +
      `_Reset: Jam 00:00 (UTC+7)_`,
    nav: ['dungeon', 'party']
  },

  // PAGE 10: Party
  {
    id: 'party',
    title: '📖 Panduan RPG — 10/12',
    text:
      `${divider('═', 30)}\n` +
      `**👥 PARTY STATS**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Command')}` +
      `\`/party\` — Lihat stats kamu + partner\n\n` +
      `${sectionHeader('Yang Ditampilkan')}` +
      `• Level, HP, ATK, DEF kedua pemain\n` +
      `• Magic ATK, Crit Rate, Gold\n` +
      `• Avg Level party\n` +
      `• Total ATK & DEF party\n\n` +
      `${sectionHeader('Tips')}` +
      `• Cek \`/party\` sebelum dungeon\n` +
      `• Kombinasi Ksatria + Penyihir = balanced\n` +
      `• Kombinasi Pencuri + Penyihir = high burst`,
    nav: ['quest', 'pvp']
  },

  // PAGE 11: PvP
  {
    id: 'pvp',
    title: '📖 Panduan RPG — 11/12',
    text:
      `${divider('═', 30)}\n` +
      `**⚔️ PVP DUEL**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Command')}` +
      `\`/duel\` — Mulai duel dengan partner\n\n` +
      `${sectionHeader('Mekanik')}` +
      `• HP = 50% max HP (duel cepat)\n` +
      `• Turn-based: Serang/Bertahan/Skill\n` +
      `• Pertama HP = 0 → kalah!\n` +
      `• Cooldown: 5 menit\n\n` +
      `${sectionHeader('Reward')}` +
      `• Winner: 50 XP + 25g\n` +
      `• Loser: 20 XP + 10g\n` +
      `• Win Streak 3x = +20% bonus!`,
    nav: ['party', 'shop']
  },

  // PAGE 12: Shop
  {
    id: 'shop',
    title: '📖 Panduan RPG — 12/12',
    text:
      `${divider('═', 30)}\n` +
      `**🏪 TOKO (EXPANDED)**\n` +
      `${divider('═', 30)}\n\n` +
      `${sectionHeader('Consumables')}` +
      `[1] Ramuan Kecil — 15g (Heal 15%)\n` +
      `[2] Ramuan Besar — 50g (Heal 50%)\n` +
      `[3] Ramuan Energi — 75g (+3 energi)\n\n` +
      `${sectionHeader('Equipment')}` +
      `[4] Pedang Karatan — 150g\n` +
      `[5] Tongkat Ranting — 80g\n` +
      `[6] Jubah Terkutuk — 200g\n` +
      `[7] Cincin Perak — 100g\n` +
      `[8] Amulet Defence — 150g\n\n` +
      `_Gunakan: \`/buy [nomor]\`_`,
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
    options: { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  };
}

function buildIndexMessage() {
  const text =
    `${divider('═', 30)}\n` +
    `**📖 PANDUAN RPG — DAFTAR ISI**\n` +
    `${divider('═', 30)}\n\n` +
    `Pilih topik yang ingin kamu baca:\n\n` +
    `1️⃣ Intro & Cara Mulai\n` +
    `2️⃣ Sistem Damage\n` +
    `3️⃣ Detail 3 Kelas\n` +
    `4️⃣ Energi & Grinding\n` +
    `5️⃣ Leveling & Stats\n` +
    `6️⃣ Equipment (4 Slot)\n` +
    `7️⃣ Ekonomi & Crafting\n` +
    `8️⃣ Dungeon Raid\n` +
    `9️⃣ Quest Harian\n` +
    `🔟 Party Stats\n` +
    `1️⃣1️⃣ PvP Duel\n` +
    `1️⃣2️⃣ Toko`;

  const buttons = [
    [Markup.button.callback('1️⃣ Intro', 'help:page:intro')],
    [Markup.button.callback('2️⃣ Damage', 'help:page:damage')],
    [Markup.button.callback('3️⃣ Kelas', 'help:page:classes')],
    [Markup.button.callback('4️⃣ Grinding', 'help:page:grinding')],
    [Markup.button.callback('5️⃣ Leveling', 'help:page:leveling')],
    [Markup.button.callback('6️⃣ Equipment', 'help:page:equipment')],
    [Markup.button.callback('7️⃣ Economy', 'help:page:economy')],
    [Markup.button.callback('8️⃣ Dungeon', 'help:page:dungeon')],
    [Markup.button.callback('9️⃣ Quest', 'help:page:quest')],
    [Markup.button.callback('🔟 Party', 'help:page:party')],
    [Markup.button.callback('1️⃣1️⃣ PvP', 'help:page:pvp')],
    [Markup.button.callback('1️⃣2️⃣ Toko', 'help:page:shop')],
  ];

  return {
    text,
    options: { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) }
  };
}

function setupHelp(bot, { rateLimitCommand }) {
  bot.command(['helprpg', 'rpghelp', 'bantuanrpg'], rateLimitCommand, (ctx) => {
    const { text, options } = buildIndexMessage();
    ctx.reply(text, options);
  });

  bot.action(/^help:page:(\w+)$/, rateLimitCommand, (ctx) => {
    const pageId = ctx.match[1];
    const page = PAGE_MAP[pageId];
    if (!page) return ctx.answerCbQuery('Halaman tidak ditemukan.', { show_alert: true });
    ctx.answerCbQuery();
    const { text, options } = buildPageMessage(page);
    ctx.editMessageText(text, options).catch(() => {});
  });

  bot.action('help:index', rateLimitCommand, (ctx) => {
    ctx.answerCbQuery();
    const { text, options } = buildIndexMessage();
    ctx.editMessageText(text, options).catch(() => {});
  });
}

module.exports = { setupHelp };
