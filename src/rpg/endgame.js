const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { createEndgameService } = require('./services/endgame');

function setupEndgame(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  const endgame = createEndgameService(db);

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
      `<i>Menangkan lantai tower dan aktivitas musiman untuk menambah points.</i>`,
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
        `Perkuat build lalu coba lagi.`,
        { parse_mode: 'HTML' },
      );
    }
    return ctx.reply(
      `🗼 <b>LANTAI ${result.floor} DITAKLUKKAN!</b>\n\n` +
      `💰 +${result.gold}g\n⭐ +${10 + result.floor} season points\n🪙 +1 token`,
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
