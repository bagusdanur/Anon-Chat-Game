const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createSocialService } = require('./services/social');

function setupSocial(bot, { getPartnerId, rateLimitCommand }) {
  const social = createSocialService(db);

  bot.command('alias', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const alias = ctx.message.text.trim().split(/\s+/)[1];
    if (!alias) return ctx.reply(`Alias karakter saat ini: ${social.getAlias(ctx.chat.id)}\nGunakan /alias NamaBaru`);
    const result = social.setAlias(ctx.chat.id, alias);
    return ctx.reply(result.success ? `✅ Alias karakter: ${result.alias}` : `❌ ${result.reason}`);
  });

  bot.command('party', (ctx, next) => {
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args.length === 0) return next();
    return rateLimitCommand(ctx, () => {
      if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
      const action = args[0].toLowerCase();
      if (action === 'create') {
        const result = social.createParty(ctx.chat.id);
        return ctx.reply(result.success ? `✅ Party #${result.partyId} dibuat.` : `❌ ${result.reason}`);
      }
      if (action === 'invite') {
        const partnerId = getPartnerId(ctx.chat.id);
        if (!partnerId) return ctx.reply('❌ Hubungkan diri dengan partner chat terlebih dahulu.');
        const result = social.invite(ctx.chat.id, partnerId);
        if (!result.success) return ctx.reply(`❌ ${result.reason}`);
        ctx.reply('✅ Undangan party dikirim ke partner.');
        return bot.telegram.sendMessage(
          partnerId,
          `👥 ${social.getAlias(ctx.chat.id)} mengundangmu ke party.\nGunakan /party accept dalam 10 menit.`,
        ).catch(() => {});
      }
      if (action === 'accept') {
        const result = social.acceptInvite(ctx.chat.id);
        return ctx.reply(result.success ? `✅ Bergabung ke party #${result.partyId}.` : `❌ ${result.reason}`);
      }
      if (action === 'leave') {
        const result = social.leaveParty(ctx.chat.id);
        return ctx.reply(result.success ? '✅ Keluar dari party.' : `❌ ${result.reason}`);
      }
      if (action === 'info') {
        const party = social.getParty(ctx.chat.id);
        if (!party) return ctx.reply('Kamu belum memiliki party. Gunakan /party create.');
        const lines = party.members.map(member =>
          `${member.role === 'owner' ? '👑' : '•'} ${member.alias}`,
        );
        return ctx.reply(`<b>👥 PARTY #${party.id}</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' });
      }
      return ctx.reply('/party create · invite · accept · info · leave');
    });
  });

  bot.command('guild', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    const action = args[0]?.toLowerCase();
    if (action === 'create') {
      const result = social.createGuild(ctx.chat.id, args[1], args.slice(2).join(' '));
      return ctx.reply(result.success ? `✅ Guild #${result.guildId} dibuat.` : `❌ ${result.reason}`);
    }
    if (action === 'join') {
      const result = social.joinGuild(ctx.chat.id, args[1]);
      return ctx.reply(result.success ? `✅ Bergabung dengan [${result.guild.tag}] ${result.guild.name}.` : `❌ ${result.reason}`);
    }
    if (action === 'contribute') {
      const result = social.contribute(ctx.chat.id, Number(args[1]));
      return ctx.reply(result.success ? '✅ Kontribusi masuk treasury guild.' : `❌ ${result.reason}`);
    }
    if (action === 'quest') {
      const result = args[1]?.toLowerCase() === 'claim'
        ? social.claimGuildQuest(ctx.chat.id)
        : social.getGuildQuest(ctx.chat.id);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      if (result.newLevel) return ctx.reply(`🏛 Quest guild selesai! Guild naik ke level ${result.newLevel}.`);
      return ctx.reply(
        `<b>📜 WEEKLY GUILD QUEST</b>\n\n` +
        `Kumpulkan kontribusi treasury: <b>${result.quest.current}/${result.quest.target}g</b>\n` +
        `Status: <b>${result.quest.status}</b>\n\n` +
        `<i>Owner/officer: /guild quest claim</i>`,
        { parse_mode: 'HTML' },
      );
    }
    if (['promote', 'demote', 'kick'].includes(action)) {
      const result = social.changeGuildRole(ctx.chat.id, args[1], action);
      return ctx.reply(result.success
        ? `✅ ${result.alias}: ${result.action} berhasil.`
        : `❌ ${result.reason}`);
    }
    if (action === 'leave') {
      const result = social.leaveGuild(ctx.chat.id);
      return ctx.reply(result.success ? '✅ Keluar dari guild.' : `❌ ${result.reason}`);
    }
    const guild = social.getGuild(ctx.chat.id);
    if (!guild) {
      return ctx.reply(
        '<b>🏛 GUILD</b>\n\n/guild create [TAG] [nama]\n/guild join [TAG]',
        { parse_mode: 'HTML' },
      );
    }
    const members = guild.members.map(member =>
      `${member.role === 'owner' ? '👑' : member.role === 'officer' ? '⭐' : '•'} ` +
      `${member.alias} · ${member.contribution}g`,
    );
    return ctx.reply(
      `<b>🏛 [${guild.tag}] ${guild.name}</b>\n` +
      `Level ${guild.level} · Treasury ${guild.treasury}g\n\n${members.join('\n')}\n\n` +
      `<i>/guild contribute [gold] · /guild quest · /guild promote|demote|kick [alias] · /guild leave</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupSocial };
