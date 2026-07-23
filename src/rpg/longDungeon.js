const { Markup } = require('telegraf');
const { db } = require('../db');
const { getOrCreateUser, xpToNextLevel, calcStats } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const {
  loadDungeons, publishDungeons, createLongDungeonService,
} = require('./services/longDungeon');

function setupLongDungeon(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  publishDungeons(db, loadDungeons());
  const service = createLongDungeonService(db, { xpToNextLevel, calcStats });

  function renderSession(session) {
    const room = service.getRoom(session);
    let text =
      `<b>${session.definition.name}</b>\n` +
      `Room ${session.state.visited.length}: <b>${room.name}</b>\n\n` +
      `${room.text}\n\n` +
      `❤️ HP <b>${session.state.hp}/${session.state.maxHp}</b>\n` +
      `🤝 Companion: <b>${session.state.companion}</b>`;
    if (session.state.log) text += `\n📝 ${session.state.log}`;

    const buttons = [];
    if (room.type === 'event') {
      for (const option of room.options || []) {
        buttons.push([Markup.button.callback(
          option.label,
          `ld:${session.id}:${session.state_version}:${option.id}`,
        )]);
      }
    } else if (['combat', 'boss'].includes(room.type)) {
      buttons.push([Markup.button.callback(
        room.type === 'boss' ? '👑 Lawan Boss' : '⚔️ Mulai Pertarungan',
        `ld:${session.id}:${session.state_version}:fight`,
      )]);
    } else if (room.type === 'treasure') {
      buttons.push([Markup.button.callback(
        '🎁 Ambil Harta',
        `ld:${session.id}:${session.state_version}:claim`,
      )]);
    } else if (room.type === 'rest') {
      buttons.push([Markup.button.callback(
        '🔥 Istirahat',
        `ld:${session.id}:${session.state_version}:rest`,
      )]);
    }
    return {
      text,
      options: { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) },
    };
  }

  function showSession(ctx, session) {
    const rendered = renderSession(session);
    return ctx.reply(rendered.text, rendered.options);
  }

  function requireEnabled(ctx) {
    if (flags.isEnabled('long_dungeons_v2')) return true;
    ctx.reply('🛠 Dungeon panjang sedang dinonaktifkan sementara.');
    return false;
  }

  function startOrResume(ctx, dungeonId = 'goblin_ruins') {
    if (!requireEnabled(ctx)) return;
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const active = service.getActive(ctx.chat.id);
    if (active) {
      ctx.reply('♻️ Melanjutkan checkpoint ekspedisi terakhir.');
      return showSession(ctx, active);
    }
    const result = service.startSolo(ctx.chat.id, dungeonId);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    return showSession(ctx, result.session);
  }

  bot.command('adventure', rateLimitCommand, ctx => {
    const dungeonId = ctx.message.text.trim().split(/\s+/)[1] || 'goblin_ruins';
    return startOrResume(ctx, dungeonId);
  });

  // Intercept hanya `/dungeon solo`; command `/dungeon` biasa diteruskan ke
  // handler raid co-op legacy yang didaftarkan setelah modul ini.
  bot.command('dungeon', (ctx, next) => {
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args[0]?.toLowerCase() !== 'solo') return next();
    return rateLimitCommand(ctx, () => startOrResume(ctx, args[1] || 'goblin_ruins'));
  });

  bot.action(/^ld:(\d+):(\d+):([a-z0-9_]+)$/, rateLimitCommand, ctx => {
    if (!requireEnabled(ctx)) return ctx.answerCbQuery();
    const sessionId = Number(ctx.match[1]);
    const version = Number(ctx.match[2]);
    const optionId = ctx.match[3];
    const session = service.get(sessionId, ctx.chat.id);
    if (!session) return ctx.answerCbQuery('Checkpoint bukan milikmu.', { show_alert: true });
    const result = service.advance(ctx.chat.id, sessionId, version, optionId);
    if (!result.success) return ctx.answerCbQuery(result.reason, { show_alert: true });
    ctx.answerCbQuery('Checkpoint tersimpan.');
    if (result.session.status === 'completed') {
      return ctx.editMessageText(
        `<b>🏆 DUNGEON SELESAI!</b>\n\n${result.room.text}\n\n` +
        `✨ +${result.session.definition.rewards.xp} XP\n` +
        `💰 +${result.session.definition.rewards.gold}g\n` +
        `🎁 Loot dan harta room telah masuk inventory.`,
        { parse_mode: 'HTML' },
      );
    }
    if (result.session.status === 'failed') {
      return ctx.editMessageText(
        `<b>💀 EKSPEDISI GAGAL</b>\n\n${result.room.text}\n\n` +
        `Gunakan /adventure untuk mencoba ekspedisi baru.`,
        { parse_mode: 'HTML' },
      );
    }
    const rendered = renderSession(result.session);
    return ctx.editMessageText(rendered.text, rendered.options);
  });
}

module.exports = { setupLongDungeon };
