const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { loadRaids, publishRaids, createRaidService } = require('./services/raids');
const { createSocialService } = require('./services/social');

function setupRaids(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  publishRaids(db, loadRaids());
  const raids = createRaidService(db);
  const social = createSocialService(db);

  function render(ctx, type, state) {
    if (!state.success) return ctx.reply(`❌ ${state.reason}`);
    const hpPercent = Math.ceil((state.instance.current_hp / state.instance.max_hp) * 100);
    const rows = raids.leaderboard(ctx.chat.id, type, 5).rows;
    const ranking = rows.length
      ? rows.map((row, index) => `${index + 1}. ${social.getAlias(row.user_id)} — ${row.damage} damage`).join('\n')
      : 'Belum ada kontribusi.';
    return ctx.reply(
      `<b>${type === 'world' ? '🌍 WORLD BOSS' : '⚔️ WEEKLY PARTY RAID'}</b>\n` +
      `<b>${state.raid.name}</b>\n\n` +
      `HP: <b>${state.instance.current_hp}/${state.instance.max_hp}</b> (${hpPercent}%)\n` +
      `Status: <b>${state.instance.status}</b>\n` +
      `Kontribusimu: <b>${state.contribution.damage}</b> damage ` +
      `(${state.contribution.attempts}/${state.raid.attemptLimit} serangan)\n\n` +
      `<b>Top kontribusi</b>\n${ranking}\n\n` +
      `Gunakan <code>/${type === 'world' ? 'worldboss' : 'raid'} attack</code> atau ` +
      `<code>/${type === 'world' ? 'worldboss' : 'raid'} claim</code>.`,
      { parse_mode: 'HTML' },
    );
  }

  function command(type) {
    return ctx => {
      if (!flags.isEnabled('asynchronous_raids_v2')) return ctx.reply('🛠 Raid sedang dinonaktifkan.');
      if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
      const action = String(ctx.message.text || '').trim().split(/\s+/)[1]?.toLowerCase() || 'status';
      if (action === 'attack') {
        const eventKey = `telegram:${ctx.chat.id}:${ctx.message.message_id}:${type}`;
        const result = raids.attack(ctx.chat.id, type, eventKey);
        if (!result.success) return ctx.reply(`❌ ${result.reason}`);
        return ctx.reply(
          `⚔️ Serangan menghasilkan <b>${result.damage} damage</b>!\n` +
          `Sisa HP ${result.raid.name}: <b>${result.instance.current_hp}/${result.instance.max_hp}</b>.`,
          { parse_mode: 'HTML' },
        );
      }
      if (action === 'claim') {
        const result = raids.claim(ctx.chat.id, type);
        if (!result.success) return ctx.reply(`❌ ${result.reason}`);
        return ctx.reply(
          `🎁 Reward diterima: <b>${result.reward.gold}g</b>, ` +
          `<b>${result.reward.seasonPoints}</b> season points, dan <b>1</b> token.`,
          { parse_mode: 'HTML' },
        );
      }
      return render(ctx, type, raids.getInstance(ctx.chat.id, type));
    };
  }

  bot.command('worldboss', rateLimitCommand, command('world'));
  bot.command('raid', rateLimitCommand, command('party'));
}

module.exports = { setupRaids };
