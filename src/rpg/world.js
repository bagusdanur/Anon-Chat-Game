const { Markup } = require('telegraf');
const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { loadRegions, publishRegions } = require('./services/contentRegistry');
const { createWorldService } = require('./services/world');
const { loadCampaign, publishCampaign, createCampaignService } = require('./services/campaign');

function setupWorld(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  const regions = loadRegions();
  publishRegions(db, regions);
  publishCampaign(db, loadCampaign());
  const campaign = createCampaignService(db);
  const world = createWorldService(db, {
    onEvent: (userId, event) => campaign.recordEvent(userId, event),
  });

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
    const partySize = db.prepare(`
      SELECT count(1) count FROM rpg_party_members
      WHERE party_id=(SELECT party_id FROM rpg_party_members WHERE user_id=?)
    `).get(String(ctx.chat.id)).count;
    const nextGuide = progress.exploration_points < 3
      ? 'Eksplorasi sampai memperoleh 3 poin petunjuk.'
      : 'Petunjuk lengkap—lanjutkan ke Adventure Reruntuhan Goblin.';
    return ctx.reply(
      `<b>🌍 ${progress.region_name}</b>\n\n` +
      `${progress.description}\n\n` +
      `<b>📍 STATUS SEKARANG</b>\n` +
      `Campaign: <b>${campaign.title}</b>\n` +
      `Objective: ${campaign.steps[currentStep]}\n` +
      `Petunjuk eksplorasi: <b>${progress.exploration_points}/3</b>\n` +
      `Party: <b>${partySize >= 2 ? `🤝 ${partySize} pemain` : '🧍 Solo'}</b>\n\n` +
      `<b>➡️ LANGKAH BERIKUTNYA</b>\n${nextGuide}\n\n` +
      `<i>💡 Encounter biasa cepat/otomatis. Dungeon dan boss memakai turn-based.</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🧭 Eksplorasi Solo', 'world:explore')],
          [Markup.button.callback('🤝 Eksplorasi Co-op', 'world:coop')],
          [Markup.button.callback('🏰 Buka Adventure', 'world:adventure')],
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
    const input = ctx.message.text.split(/\s+/)[1];
    const regions = world.listRegions(user.level);
    if (!input) {
      const list = regions
        .map((region, index) => `<code>[${index + 1}]</code> ${region.name} · Lv.${region.min_level}`)
        .join('\n');
      return ctx.reply(`<b>🗺 REGION TERBUKA</b>\n\n${list}\n\nGunakan <code>/travel [nomor]</code>.`, {
        parse_mode: 'HTML',
      });
    }
    const number = Number(input);
    const regionId = Number.isInteger(number) && number >= 1
      ? regions[number - 1]?.region_id
      : input;
    if (!regionId) return ctx.reply('❌ Nomor region tidak valid. Ketik /travel.');
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
      ? '\n\n🔓 Petunjuk cukup! Langkah berikutnya: buka /adventure dan pilih mode duo atau solo.'
      : `\n\n➡️ Cari ${Math.max(0, 3 - result.progress.exploration_points)} poin lagi.`;
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
      .map((region, index) => `<code>[${index + 1}]</code> ${region.name} · Lv.${region.min_level}`)
      .join('\n');
    return ctx.reply(`<b>Region tersedia</b>\n\n${list}\n\n<i>/travel [nomor]</i>`, { parse_mode: 'HTML' });
  });
  bot.action('world:coop', async ctx => {
    await ctx.answerCbQuery();
    const party = db.prepare(`
      SELECT count(1) count FROM rpg_party_members
      WHERE party_id=(SELECT party_id FROM rpg_party_members WHERE user_id=?)
    `).get(String(ctx.chat.id));
    if (party.count < 2) {
      return ctx.reply(
        '🤝 Buat party dulu: `/party create`, hubungkan partner chat, lalu `/party invite`.',
        { parse_mode: 'Markdown' },
      );
    }
    return ctx.reply(
      '<b>🤝 CO-OP WORLD</b>\n\nGunakan /coopcampaign untuk melihat progres party, lalu /coopcampaign explore untuk menjelajah bersama.',
      { parse_mode: 'HTML' },
    );
  });
  bot.action('world:adventure', async ctx => {
    await ctx.answerCbQuery();
    return ctx.reply('🏰 Ketik /adventure untuk memilih dungeon dan mode turn-based.');
  });
}

module.exports = { setupWorld };
