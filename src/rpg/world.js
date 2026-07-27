const { Markup } = require('telegraf');
const { db } = require('../db');
const { getOrCreateUser, getCurrentEnergy, spendEnergy, MAX_ENERGY } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { loadRegions, publishRegions } = require('./services/contentRegistry');
const { createWorldService } = require('./services/world');
const { loadCampaign, publishCampaign, createCampaignService } = require('./services/campaign');
const { getGuideFlow } = require('./guide');

function setupWorld(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  publishRegions(db, loadRegions());
  publishCampaign(db, loadCampaign());
  const campaignService = createCampaignService(db);
  const world = createWorldService(db, {
    onEvent: (userId, event) => campaignService.recordEvent(userId, event),
  });

  function requireWorld(ctx) {
    if (!flags.isEnabled('world_v2')) {
      ctx.reply('Dunia RPG sedang dipersiapkan. Progress karaktermu tetap aman.');
      return null;
    }
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) {
      ctx.reply('Kamu belum punya karakter. Gunakan /profile untuk memulai.');
      return null;
    }
    return user;
  }

  function flowReply(ctx, flow, intro = 'Aksi itu belum sesuai fase campaign-mu.') {
    return ctx.reply(
      `<b>INFO ALUR CAMPAIGN</b>\n\n${intro}\n\n` +
      `<b>${flow.next.title}</b>\n${flow.next.detail}\n` +
      `Jalankan: <code>${flow.next.command}</code>`,
      { parse_mode: 'HTML' },
    );
  }

  function worldMenu(ctx) {
    const user = requireWorld(ctx);
    if (!user) return;
    const progress = world.getProgress(ctx.chat.id);
    if (!progress) return ctx.reply('Region awal belum tersedia.');
    const flow = getGuideFlow(ctx.chat.id);
    const objective = flow.state.activeQuest?.objective;
    const partySize = db.prepare(`
      SELECT count(1) count FROM rpg_party_members
      WHERE party_id=(SELECT party_id FROM rpg_party_members WHERE user_id=?)
    `).get(String(ctx.chat.id)).count;
    return ctx.reply(
      `<b>WORLD: ${progress.region_name}</b>\n\n${progress.description}\n\n` +
      `<b>STATUS SEKARANG</b>\n` +
      `Campaign: <b>${flow.state.activeQuest?.title || 'Campaign tersedia selesai'}</b>\n` +
      `Objective: ${objective ? `${objective.label} <b>${objective.current}/${objective.target}</b>` : '<b>Menunggu chapter berikutnya</b>'}\n` +
      `Party: <b>${partySize >= 2 ? `Duo (${partySize} pemain)` : 'Solo'}</b>\n\n` +
      `<b>LANGKAH BERIKUTNYA</b>\n<b>${flow.next.title}</b>\n${flow.next.detail}\n` +
      `Jalankan: <code>${flow.next.command}</code>\n\n` +
      `<i>Guide adalah tracker utama. Encounter biasa cepat; dungeon dan boss memakai turn-based.</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('Panduan Alur Saya', 'guide:open')],
          [Markup.button.callback('Eksplorasi', 'world:explore')],
          [Markup.button.callback('Co-op World', 'world:coop')],
          [Markup.button.callback('Buka Dungeon', 'world:adventure')],
          [Markup.button.callback('Daftar Region', 'world:regions')],
        ]),
      },
    );
  }

  bot.command('rpg', rateLimitCommand, worldMenu);
  bot.command('world', rateLimitCommand, worldMenu);

  bot.command('travel', rateLimitCommand, ctx => {
    const user = requireWorld(ctx);
    if (!user) return;
    const flow = getGuideFlow(ctx.chat.id);
    const input = ctx.message.text.split(/\s+/)[1];
    const regions = world.listRegions(user.level);
    if (!input) {
      const list = regions.map((region, index) =>
        `<code>[${index + 1}]</code> ${region.name} · Lv.${region.min_level}`).join('\n');
      return ctx.reply(`<b>REGION TERBUKA</b>\n\n${list}\n\nGunakan <code>/travel [nomor]</code>.`, {
        parse_mode: 'HTML',
      });
    }
    const number = Number(input);
    const regionId = Number.isInteger(number) && number >= 1 ? regions[number - 1]?.region_id : input;
    if (!regionId) return ctx.reply('Nomor region tidak valid. Ketik /travel.');
    if (flow.next.key !== 'travel' || flow.state.activeQuest?.objective?.targetId !== regionId) {
      return flowReply(ctx, flow, 'Perjalanan cerita hanya dapat dilakukan ke region objective aktif.');
    }
    const result = world.travel(ctx.chat.id, regionId, user.level);
    if (!result.success) return ctx.reply(`Tidak bisa travel: ${result.reason}`);
    const after = getGuideFlow(ctx.chat.id);
    return ctx.reply(`Kamu tiba di <b>${result.region.name}</b>.\n\n${after.next.detail}\nJalankan: <code>${after.next.command}</code>`, { parse_mode: 'HTML' });
  });

  async function explore(ctx) {
    const user = requireWorld(ctx);
    if (!user) return;
    const before = getGuideFlow(ctx.chat.id);
    if (before.next.key !== 'explore') return flowReply(ctx, before, 'Eksplorasi tidak sedang menjadi objective aktif.');
    const energy = getCurrentEnergy(user);
    if (energy < 1) {
      return ctx.reply(`Energi tidak cukup untuk eksplorasi. Energi: <b>${energy}/${MAX_ENERGY}</b>\n<i>Regenerasi +1 setiap 3 menit, atau gunakan Ramuan Energi.</i>`, { parse_mode: 'HTML' });
    }
    spendEnergy(ctx.chat.id, 1);
    const result = world.explore(ctx.chat.id);
    if (!result.success) return ctx.reply(`Eksplorasi gagal: ${result.reason}`);
    const labels = { combat: 'Encounter', treasure: 'Harta', event: 'Peristiwa' };
    const completedProgress = Math.min(
      before.state.activeQuest.objective.target,
      (before.state.activeQuest.objective.current || 0) + 1,
    );
    const after = getGuideFlow(ctx.chat.id);
    return ctx.reply(
      `<b>${labels[result.encounter.type] || 'Eksplorasi'}: ${result.encounter.name}</b>\n` +
      `Petunjuk campaign: <b>${completedProgress}/${before.state.activeQuest.objective.target}</b>` +
      (result.material ? `\nMaterial region: <b>${result.material.replace(/_/g, ' ')}</b>` : '') +
      `\n\n<b>Langkah berikutnya:</b> ${after.next.detail}\nJalankan: <code>${after.next.command}</code>`,
      { parse_mode: 'HTML' },
    );
  }

  bot.command('explore', rateLimitCommand, explore);
  bot.action('world:explore', async ctx => { await ctx.answerCbQuery(); return explore(ctx); });
  bot.action('world:regions', async ctx => {
    await ctx.answerCbQuery();
    const user = requireWorld(ctx);
    if (!user) return;
    const list = world.listRegions(user.level).map((region, index) =>
      `<code>[${index + 1}]</code> ${region.name} · Lv.${region.min_level}`).join('\n');
    return ctx.reply(`<b>Region tersedia</b>\n\n${list}\n\n<i>/travel [nomor]</i>`, { parse_mode: 'HTML' });
  });
  bot.action('world:coop', async ctx => {
    await ctx.answerCbQuery();
    const party = db.prepare(`SELECT count(1) count FROM rpg_party_members WHERE party_id=(SELECT party_id FROM rpg_party_members WHERE user_id=?)`).get(String(ctx.chat.id));
    if (party.count < 2) return ctx.reply('Buat party dulu: /party create, hubungkan partner chat, lalu /party invite.');
    const flow = getGuideFlow(ctx.chat.id);
    if (flow.next.key !== 'explore') return flowReply(ctx, flow, 'Co-op eksplorasi mengikuti objective campaign yang sama.');
    return ctx.reply('CO-OP WORLD\n\nGunakan /coopcampaign explore. Setiap pemain tetap menghabiskan energi dan mendapat progress campaign miliknya sendiri.');
  });
  bot.action('world:adventure', async ctx => {
    await ctx.answerCbQuery();
    const flow = getGuideFlow(ctx.chat.id);
    if (!['dungeon', 'resume'].includes(flow.next.key)) return flowReply(ctx, flow, 'Dungeon belum menjadi langkah campaign aktif.');
    return ctx.reply(`Buka <code>${flow.next.command}</code>. ${flow.next.detail}`, { parse_mode: 'HTML' });
  });
}

module.exports = { setupWorld };
