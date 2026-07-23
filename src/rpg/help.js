// Panduan RPG v2 — selalu sinkron dengan fitur produksi.
const { Markup } = require('telegraf');

const HELP_PAGES = [
  {
    id: 'start',
    title: '📖 RPG BESAR — MULAI',
    text:
      'Progress karakter tersimpan permanen dan tidak bergantung pada partner chat.\n\n' +
      '<b>Langkah awal</b>\n' +
      '1. /profile — buat atau lihat karakter\n' +
      '2. /rpg — buka dunia RPG\n' +
      '3. /campaign — lihat cerita utama\n' +
      '4. /explore — jelajahi region aktif\n' +
      '5. /hunt, /fish, /mine — grinding dasar\n\n' +
      '<b>Build</b>\n' +
      '/skill — pelajari dan pasang skill\n' +
      '/build — lihat loadout combat\n' +
      '/gear — equipment v2 dan item power',
  },
  {
    id: 'world',
    title: '🌍 WORLD & CAMPAIGN',
    text:
      '/world — region dan progress dunia\n' +
      '/travel [nomor] — pindah region\n' +
      '/explore — encounter dan progress campaign\n' +
      '/campaign — chapter serta objective utama\n' +
      '/coopcampaign — progress campaign anggota party\n' +
      '/coopcampaign explore — eksplorasi co-op\n\n' +
      'Progress campaign setiap karakter tetap independen. Partner tidak dapat menaikkan progress-mu tanpa aksimu sendiri.',
  },
  {
    id: 'combat',
    title: '⚔️ COMBAT & BUILD',
    text:
      '<b>Combat tactical</b>\n' +
      'Attack, defend, skill, cooldown, status effect, resist, crit, dan boss mechanic tersedia pada dungeon tactical, duel, dan raid.\n\n' +
      '/skill — skill tree\n' +
      '/build — loadout aktif\n' +
      '/duel — PvP opsional dengan partner\n' +
      '/tower — Endless Tower\n' +
      '/worldboss — boss global asynchronous\n' +
      '/raid — weekly raid untuk party\n\n' +
      'Equipment v2, affix, gem, dan set bonus aktif pada seluruh formula combat.',
  },
  {
    id: 'dungeon',
    title: '🏰 DUNGEON PANJANG',
    text:
      '/adventure — panduan dan daftar dungeon\n' +
      '/adventure solo [nomor] — turn-based dengan companion\n' +
      '/adventure duo [nomor] — turn-based bersama party\n' +
      '/dungeon solo — alias mode solo\n' +
      '/dungeon duo — mode checkpoint bersama\n' +
      '/dungeon — raid co-op combat lama\n\n' +
      'Dungeon memiliki jalur bercabang, combat, event, treasure, rest point, boss, checkpoint 24 jam, dan proteksi callback ganda.',
  },
  {
    id: 'equipment',
    title: '🛡 EQUIPMENT V2',
    text:
      '/gear — daftar Equipment V2 bernomor\n' +
      '/gear forge [nomor /inv] — konversi equipment lama\n' +
      '/gear equip [nomor gear] — pasang dan bind\n' +
      '/gear socket [gear] [slot] [nomor gem /inv]\n' +
      '/gear upgrade [nomor gear] — upgrade hingga +15\n' +
      '/gear reforge [nomor gear] — roll ulang affix\n\n' +
      'Set tersedia: Dragon Regalia dan Cursed Sovereign. Sistem /equip dan /upgrade lama tetap kompatibel.',
  },
  {
    id: 'economy',
    title: '💰 ECONOMY & PROFESSION',
    text:
      '/inv, /shop, /buy, /sell, /use — inventory umum\n' +
      '/profession — tujuh profession\n' +
      '/gather herb — gathering Herbalism\n' +
      '/craft — crafting recipe\n' +
      '/salvage [item] — bongkar equipment\n' +
      '/refine [material] — refinement material\n' +
      '/market — daftar listing bernomor\n' +
      '/market sell [nomor /inv] [qty] [harga]\n' +
      '/market buy [nomor /market]\n' +
      '/market cancel [nomor /market]\n\n' +
      'Marketplace memiliki expiry, batas harga, listing limit, item binding, transaksi atomik, dan ledger.',
  },
  {
    id: 'trade',
    title: '🤝 PARTY & TRADE',
    text:
      '/alias [nama] — alias anonim karakter\n' +
      '/party create — buat party\n' +
      '/party invite — undang partner chat\n' +
      '/party accept, /party info, /party leave\n\n' +
      '<b>Direct trade aman</b>\n' +
      '/trade offer gold [jumlah]\n' +
      '/trade offer item [item_id] [jumlah]\n' +
      '/trade accept [id]\n' +
      '/trade cancel [id]\n\n' +
      'Isi trade dibekukan sebagai snapshot dan baru dipindahkan setelah konfirmasi partner.',
  },
  {
    id: 'guild',
    title: '🏛 GUILD',
    text:
      '/guild create [TAG] [nama]\n' +
      '/guild join [TAG]\n' +
      '/guild contribute [gold]\n' +
      '/guild quest — quest kolektif mingguan\n' +
      '/guild quest claim — naikkan level guild\n' +
      '/guild upgrade — naikkan level & kapasitas\n' +
      '/guild shop — fasilitas treasury\n' +
      '/guild promote [nomor]\n' +
      '/guild demote [nomor]\n' +
      '/guild kick [nomor]\n' +
      '/guild leave\n\n' +
      'Role owner/officer/member memiliki permission berbeda dan seluruh perubahan role diaudit.',
  },
  {
    id: 'endgame',
    title: '🏆 SEASON & ENDGAME',
    text:
      '/season — points dan seasonal token\n' +
      '/rank — leaderboard alias anonim\n' +
      '/tower — Endless Tower\n' +
      '/achievement — achievement permanen\n' +
      '/collection — koleksi item\n' +
      '/worldboss attack|claim\n' +
      '/raid attack|claim\n' +
      '/bounty hunt|claim — duo bounty harian\n\n' +
      'Karakter utama permanen; hanya track, token, ranking, dan challenge musiman yang direset.',
  },
  {
    id: 'privacy',
    title: '🔒 PRIVASI & RECOVERY',
    text:
      'Nama, username, foto profil, dan identitas Telegram tidak ditampilkan pada partner, party, guild, market, ranking, atau dungeon.\n\n' +
      'Callback combat memakai version check. Reward, trade, marketplace, bounty, dan raid memiliki receipt/idempotency agar retry atau restart tidak memberi hadiah ganda.\n\n' +
      'Gunakan /helprpg kapan saja untuk kembali ke daftar isi.',
  },
];

const PAGE_MAP = Object.fromEntries(HELP_PAGES.map(page => [page.id, page]));

function indexMessage() {
  const rows = [];
  for (let index = 0; index < HELP_PAGES.length; index += 2) {
    rows.push(HELP_PAGES.slice(index, index + 2).map(page =>
      Markup.button.callback(page.title.split(' — ')[0], `help:page:${page.id}`)));
  }
  return {
    text:
      '<b>📖 PANDUAN ANONYMOUS RPG</b>\n\n' +
      'Pilih bagian panduan. Semua menu di bawah sudah mengikuti fitur RPG produksi terbaru.',
    options: { parse_mode: 'HTML', ...Markup.inlineKeyboard(rows) },
  };
}

function pageMessage(page) {
  const index = HELP_PAGES.findIndex(item => item.id === page.id);
  const nav = [];
  if (index > 0) nav.push(Markup.button.callback('◀️', `help:page:${HELP_PAGES[index - 1].id}`));
  nav.push(Markup.button.callback('📋 Daftar Isi', 'help:index'));
  if (index < HELP_PAGES.length - 1) {
    nav.push(Markup.button.callback('▶️', `help:page:${HELP_PAGES[index + 1].id}`));
  }
  return {
    text: `<b>${page.title}</b>\n\n${page.text}\n\n<i>Halaman ${index + 1}/${HELP_PAGES.length}</i>`,
    options: { parse_mode: 'HTML', ...Markup.inlineKeyboard([nav]) },
  };
}

function setupHelp(bot, { rateLimitCommand }) {
  bot.command(['helprpg', 'rpghelp', 'bantuanrpg'], rateLimitCommand, ctx => {
    const message = indexMessage();
    return ctx.reply(message.text, message.options);
  });
  bot.action(/^help:page:(\w+)$/, ctx => {
    const page = PAGE_MAP[ctx.match[1]];
    if (!page) return ctx.answerCbQuery('Halaman tidak ditemukan.', { show_alert: true });
    const message = pageMessage(page);
    ctx.answerCbQuery();
    return ctx.editMessageText(message.text, message.options).catch(() => {});
  });
  bot.action('help:index', ctx => {
    const message = indexMessage();
    ctx.answerCbQuery();
    return ctx.editMessageText(message.text, message.options).catch(() => {});
  });
}

module.exports = { HELP_PAGES, indexMessage, pageMessage, setupHelp };
