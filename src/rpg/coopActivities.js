const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { loadRegions, publishRegions } = require('./services/contentRegistry');
const { loadCampaign, publishCampaign, createCampaignService } = require('./services/campaign');
const { createWorldService } = require('./services/world');
const { createSocialService } = require('./services/social');
const { createCoopActivityService } = require('./services/coopActivities');

function setupCoopActivities(bot, { rateLimitCommand }) {
  publishRegions(db, loadRegions());
  publishCampaign(db, loadCampaign());
  const campaign = createCampaignService(db);
  const world = createWorldService(db, {
    onEvent: (userId, event) => campaign.recordEvent(userId, event),
  });
  const social = createSocialService(db);
  const coop = createCoopActivityService(db);

  function requireCharacter(ctx) {
    return getOrCreateUser(ctx.chat.id) || (ctx.reply('Buat karakter terlebih dahulu dengan /profile.'), null);
  }

  bot.command('bounty', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const action = ctx.message.text.trim().split(/\s+/)[1]?.toLowerCase() || 'status';
    if (action === 'hunt') {
      const result = coop.act(ctx.chat.id, `telegram:${ctx.chat.id}:${ctx.message.message_id}:bounty`);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `🎯 Kamu menyumbang <b>${result.amount}</b> progress.\n` +
        `Duo bounty: <b>${result.bounty.progress}/${result.bounty.target}</b>.`,
        { parse_mode: 'HTML' },
      );
    }
    if (action === 'claim') {
      const result = coop.claim(ctx.chat.id);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `🎁 Duo bounty diklaim: <b>${result.reward.gold}g</b>, ` +
        `<b>${result.reward.seasonPoints}</b> season points, dan 1 token.`,
        { parse_mode: 'HTML' },
      );
    }
    const state = coop.getBounty(ctx.chat.id);
    if (!state.success) return ctx.reply(`❌ ${state.reason}`);
    return ctx.reply(
      `<b>🎯 DUO BOUNTY HARIAN</b>\n\n` +
      `Progress party: <b>${state.bounty.progress}/${state.bounty.target}</b>\n` +
      `Kontribusimu: <b>${state.personal.contribution}</b> ` +
      `(${state.personal.actions}/3 aksi)\n` +
      `Status: <b>${state.bounty.status}</b>\n\n` +
      `<i>/bounty hunt · /bounty claim</i>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('coopcampaign', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const party = social.getParty(ctx.chat.id);
    if (!party || party.members.length < 2) return ctx.reply('❌ Co-op campaign memerlukan party minimal 2 pemain.');
    const action = ctx.message.text.trim().split(/\s+/)[1]?.toLowerCase() || 'status';
    if (action === 'explore') {
      const result = world.explore(ctx.chat.id);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `🧭 ${result.encounter.name}: progress campaign karaktermu bertambah.\n` +
        `Anggota party lain tetap harus melakukan /coopcampaign explore sendiri.`,
      );
    }
    const lines = party.members.map(member => {
      const quests = campaign.list(member.user_id);
      const active = quests.find(quest => quest.status === 'active');
      const completed = quests.filter(quest => ['completed', 'claimed'].includes(quest.status)).length;
      return `• <b>${member.alias}</b> — ${active ? active.title : 'Chapter selesai'} (${completed} selesai)`;
    });
    return ctx.reply(
      `<b>📖 CO-OP CAMPAIGN PARTY</b>\n\n${lines.join('\n')}\n\n` +
      `<i>Progress tetap independen. Gunakan /coopcampaign explore untuk aksi karaktermu.</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupCoopActivities };
