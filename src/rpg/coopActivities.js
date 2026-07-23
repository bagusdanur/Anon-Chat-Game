const { db } = require('../db');
const { Markup } = require('telegraf');
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

  bot.command('coop', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const party = social.getParty(ctx.chat.id);
    const partyStatus = party?.members?.length >= 2
      ? `✅ Party aktif: ${party.members.map(member => member.alias).join(' + ')}`
      : '⚠️ Belum ada duo. Saat sedang anonymous chat: /party create lalu /party invite';
    return ctx.reply(
      `<b>🤝 PUSAT ANONYMOUS CO-OP</b>\n\n${partyStatus}\n\n` +
      `<b>Aktivitas duo:</b>\n` +
      `1. 🏰 Dungeon panjang — banyak monster, giliran bergantian, Combo\n` +
      `2. 🎯 Bounty harian — kontribusi kedua pemain\n` +
      `3. 📖 Campaign party — jelajah bersama, progress masing-masing\n` +
      `4. 🔥 Weekly raid — boss party dan reward kontribusi\n` +
      `5. ⚔️ Duel partner — latihan build tanpa membuka identitas\n\n` +
      `<i>Mulai paling terasa: buat party lalu pilih Dungeon Duo.</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('👥 Panduan Party', 'coop:guide:party'),
            Markup.button.callback('🏰 Dungeon Duo', 'coop:guide:dungeon'),
          ],
          [
            Markup.button.callback('🎯 Bounty', 'coop:guide:bounty'),
            Markup.button.callback('📖 Campaign', 'coop:guide:campaign'),
          ],
          [
            Markup.button.callback('🔥 Raid', 'coop:guide:raid'),
            Markup.button.callback('⚔️ Duel', 'coop:guide:duel'),
          ],
        ]),
      },
    );
  });

  bot.action(/^coop:guide:(party|dungeon|bounty|campaign|raid|duel)$/, ctx => {
    const guides = {
      party: '👥 Saat terhubung anonymous chat: /party create → /party invite. Partner menekan /party accept.',
      dungeon: '🏰 Gunakan /dungeon duo 1. Aksi wajib bergantian; kumpulkan 3 energi lalu tekan 🤝 Combo.',
      bounty: '🎯 Kedua pemain gunakan /bounty hunt, lalu masing-masing /bounty claim setelah target selesai.',
      campaign: '📖 Gunakan /coopcampaign. Kedua pemain melakukan /coopcampaign explore agar progress masing-masing naik.',
      raid: '🔥 Gunakan /raid attack sampai boss tumbang, lalu masing-masing /raid claim.',
      duel: '⚔️ Gunakan /duel saat masih terhubung dengan partner anonymous chat.',
    };
    ctx.answerCbQuery();
    return ctx.reply(guides[ctx.match[1]]);
  });

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
