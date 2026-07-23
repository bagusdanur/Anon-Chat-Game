const { Markup } = require('telegraf');
const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { loadRegions, publishRegions } = require('./services/contentRegistry');
const { createWorldService } = require('./services/world');

function setupWorld(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  const regions = loadRegions();
  publishRegions(db, regions);
  const world = createWorldService(db);

  function requireWorld(ctx) {
    if (!flags.isEnabled('world_v2')) {
      ctx.reply('🛠 Dunia RPG sedang dipersiapkan. Progress karaktermu tetap aman.');
      return null;
    }
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) {
      ctx.reply('Kamu belum punya karakter. Gunakan /profile untuk memulai.');
      return null;
    }
    return user;
  }

  function worldMenu(ctx) {
    const user = requireWorld(ctx);
    if (!user) return;
    const progress = world.getProgress(ctx.chat.id);
    if (!progress) return ctx.reply('Region awal belum tersedia.');
    const content = JSON.parse(progress.content_json);
    const campaign = content.campaign;
    const currentStep = Math.min(progress.campaign_step, campaign.steps.length - 1);
    return ctx.reply(
      `<b>🌍 ${progress.region_name}</b>\n\n` +
      `${progress.description}\n\n` +
      `<b>Campaign:</b> ${campaign.title}\n` +
      `📜 ${campaign.steps[currentStep]}\n` +
      `🧭 Poin eksplorasi: <b>${progress.exploration_points}</b>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🧭 Eksplorasi', 'world:explore')],
          [Markup.button.callback('🗺 Daftar Region', 'world:regions')],
        ]),
      },
    );
  }

  bot.command('rpg', rateLimitCommand, worldMenu);
  bot.command('world', rateLimitCommand, worldMenu);

  bot.command('travel', rateLimitCommand, ctx => {
    const user = requireWorld(ctx);
    if (!user) return;
    const regionId = ctx.message.text.split(/\s+/)[1];
    if (!regionId) {
      const list = world.listRegions(user.level)
        .map(region => `• <code>${region.region_id}</code> — ${region.name}`)
        .join('\n');
      return ctx.reply(`<b>Region yang bisa dikunjungi</b>\n\n${list}\n\nGunakan <code>/travel region_id</code>.`, {
        parse_mode: 'HTML',
      });
    }
    const result = world.travel(ctx.chat.id, regionId, user.level);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    return ctx.reply(`🗺 Kamu tiba di <b>${result.region.name}</b>.`, { parse_mode: 'HTML' });
  });

  async function explore(ctx) {
    const user = requireWorld(ctx);
    if (!user) return;
    const result = world.explore(ctx.chat.id);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    const encounter = result.encounter;
    const labels = {
      combat: '⚔️ Encounter',
      treasure: '🎁 Harta',
      event: '📜 Peristiwa',
    };
    const stepUnlocked = result.progress.campaign_step >= 2
      ? '\n\n🔓 Petunjuk cukup! Jalan menuju Reruntuhan Goblin telah terbuka.'
      : '';
    return ctx.reply(
      `<b>${labels[encounter.type] || '🧭 Eksplorasi'}: ${encounter.name}</b>\n` +
      `Kamu memperoleh <b>+${result.points}</b> poin eksplorasi.${stepUnlocked}`,
      { parse_mode: 'HTML' },
    );
  }

  bot.command('explore', rateLimitCommand, explore);
  bot.action('world:explore', async ctx => {
    await ctx.answerCbQuery();
    return explore(ctx);
  });
  bot.action('world:regions', async ctx => {
    await ctx.answerCbQuery();
    const user = requireWorld(ctx);
    if (!user) return;
    const list = world.listRegions(user.level)
      .map(region => `• <code>${region.region_id}</code> — ${region.name}`)
      .join('\n');
    return ctx.reply(`<b>Region tersedia</b>\n\n${list}`, { parse_mode: 'HTML' });
  });
}

module.exports = { setupWorld };
