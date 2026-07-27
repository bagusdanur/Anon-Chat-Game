const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { createEndgameService } = require('./services/endgame');
const { createItemCatalogService } = require('./services/itemCatalog');

function setupEndgame(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  const endgame = createEndgameService(db);
  const catalog = createItemCatalogService(db);
  catalog.validate();

  function requireCharacter(ctx) {
    if (!flags.isEnabled('seasons_v2')) {
      ctx.reply('🛠 Season sedang dinonaktifkan sementara.');
      return false;
    }
    if (!getOrCreateUser(ctx.chat.id)) {
      ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
      return false;
    }
    return true;
  }

  bot.command('season', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const { season, progress } = endgame.getProgress(ctx.chat.id);
    const remainingDays = Math.max(0, Math.ceil((season.ends_at - Date.now() / 1000) / 86400));
    return ctx.reply(
      `<b>🏆 ${season.name}</b>\n\n` +
      `⭐ Points: <b>${progress.points}</b>\n` +
      `🪙 Seasonal token: <b>${progress.currency}</b>\n` +
      `📅 Berakhir dalam <b>${remainingDays} hari</b>\n\n` +
      `<i>💡 Mulai dari /tower. Duo bounty dan raid juga memberi progress season tanpa menghapus karakter permanen.</i>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('rank', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const rows = endgame.leaderboard(10);
    if (!rows.length) return ctx.reply('Leaderboard season masih kosong.');
    const medals = ['🥇', '🥈', '🥉'];
    const lines = rows.map(row =>
      `${medals[row.rank - 1] || `${row.rank}.`} <b>${row.alias}</b> — ${row.points} pts`,
    );
    return ctx.reply(
      `<b>🏆 LEADERBOARD SEASON</b>\n\n${lines.join('\n')}\n\n<i>Alias tidak mengungkap identitas Telegram.</i>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('tower', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const result = endgame.attemptTower(ctx.chat.id);
    if (!result.success) return ctx.reply(`⏳ ${result.reason}`);
    endgame.syncAchievements(ctx.chat.id);
    if (!result.win) {
      return ctx.reply(
        `💀 <b>ENDLESS TOWER — Lantai ${result.floor}</b>\n\n` +
        `Power ${result.playerPower} belum cukup melawan musuh ${result.enemyPower}.\n` +
        `Perkuat build lalu coba lagi.\n\n` +
        `<i>💡 Cek /skill dan /gear. Upgrade bonus utama class-mu sebelum mencoba lagi.</i>`,
        { parse_mode: 'HTML' },
      );
    }
    return ctx.reply(
      `🗼 <b>LANTAI ${result.floor} DITAKLUKKAN!</b>\n\n` +
      `💰 +${result.gold}g\n⭐ +${10 + result.floor} season points\n🪙 +1 token\n\n` +
      `<i>➡️ Lantai berikutnya makin kuat; rapikan build di /profile sebelum lanjut.</i>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command(['achievement', 'achievements'], rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const achievements = endgame.listAchievements(ctx.chat.id);
    const lines = achievements.map(item =>
      `${item.unlocked ? '✅' : '🔒'} <b>${item.name}</b>\n   <i>${item.description}</i>`,
    );
    return ctx.reply(`<b>🎖 ACHIEVEMENTS</b>\n\n${lines.join('\n\n')}`, { parse_mode: 'HTML' });
  });

  bot.command('catalog', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const entries = catalog.all(ctx.chat.id);
    const input = ctx.message.text.trim().split(/\s+/).slice(1).join(' ').toLowerCase();
    const number = Number(input);
    if (Number.isInteger(number) && number > 0) {
      const item = entries[number - 1];
      if (!item) return ctx.reply('Nomor katalog tidak valid. Ketik /catalog.');
      return ctx.reply(
        `<b>📖 [${item.number}] ${item.display_name}</b>\n` +
        `${catalog.labels[item.category] || item.category} · ${item.rarity}\n` +
        `${item.owned ? '✅ Sudah ditemukan' : '▫️ Belum ditemukan'}\n\n` +
        `<b>📍 Cara mendapatkan</b>\n• ${item.sources.join('\n• ')}\n\n` +
        `<b>🛠 Kegunaan</b>\n• ${(item.uses.length ? item.uses : ['Belum ada resep khusus']).join('\n• ')}`,
        { parse_mode: 'HTML' },
      );
    }
    const categoryMatch = input.match(/^(consumable|material|weapon|staff|armor|accessory)(?:\s+(\d+))?$/);
    const category = categoryMatch?.[1] || null;
    const filtered = category ? entries.filter(item => item.category === category) : entries;
    const page = Math.max(1, Number(categoryMatch?.[2]) || 1);
    const pageSize = 12;
    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
    const owned = entries.filter(item => item.owned).length;
    return ctx.reply(
      `<b>📖 KATALOG ITEM</b> · ${owned}/${entries.length} ditemukan\n` +
      `<i>Halaman ${page}/${pages}${category ? ` · ${catalog.labels[category]}` : ''}</i>\n\n` +
      visible.map(item => `${item.owned ? '✅' : '▫️'} <code>[${item.number}]</code> ${item.display_name} <i>${item.rarity}</i>`).join('\n') +
      `\n\n<i>/catalog [nomor] untuk sumber & kegunaan\n/catalog material 2 · /catalog consumable · /catalog weapon</i>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('collection', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const collection = endgame.collection(ctx.chat.id);
    return ctx.reply(
      `<b>📚 ITEM COLLECTION</b>\n\n` +
      `Ditemukan: <b>${collection.owned}/${collection.total}</b>\n` +
      `Completion: <b>${collection.percent}%</b>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupEndgame };
