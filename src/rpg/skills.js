const { Markup } = require('telegraf');
const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const {
  loadSkills,
  publishSkills,
  createSkillService,
} = require('./services/skills');
const { resolveNumberedId } = require('./inputResolvers');

function setupSkills(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  publishSkills(db, loadSkills());
  const service = createSkillService(db);

  function resolveSkillInput(userId, input) {
    const tree = service.getTree(userId);
    if (!tree) return input;
    return resolveNumberedId(tree.skills, input);
  }

  function requireCharacter(ctx) {
    if (!flags.isEnabled('character_builds_v2')) {
      ctx.reply('🛠 Sistem build sedang dinonaktifkan sementara.');
      return null;
    }
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) {
      ctx.reply('Buat karakter terlebih dahulu lewat /profile.');
      return null;
    }
    return user;
  }

  function renderTree(userId) {
    const tree = service.getTree(userId);
    if (!tree) return 'Karakter tidak ditemukan.';
    const lines = tree.skills.map((skill, index) => {
      const rank = `${skill.rank}/${skill.max_rank}`;
      const equipped = skill.equipped_slot ? ` · Slot ${skill.equipped_slot}` : '';
      const lock = tree.user.level < skill.min_level ? ` 🔒 Lv.${skill.min_level}` : '';
      const requiredSkill = tree.skills.find(item => item.id === skill.requires);
      const requirement = requiredSkill && skill.rank === 0 ? ` · butuh ${requiredSkill.name}` : '';
      return `<code>[${index + 1}]</code> <b>${skill.name}</b> <code>${rank}</code>${equipped}${lock}\n` +
        `<i>${skill.description}${requirement}</i>`;
    });
    return `<b>🌟 SKILL TREE — ${tree.user.class_name.toUpperCase()}</b>\n` +
      `Skill point tersedia: <b>${tree.availablePoints}</b>\n\n${lines.join('\n\n')}\n\n` +
      `<i>/skill learn [nomor]\n/skill equip [nomor] [slot]\n/skill respec</i>`;
  }

  function showSkills(ctx) {
    if (!requireCharacter(ctx)) return;
    return ctx.reply(renderTree(ctx.chat.id), { parse_mode: 'HTML' });
  }

  bot.command('skill', rateLimitCommand, ctx => {
    if (!requireCharacter(ctx)) return;
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args.length === 0) return showSkills(ctx);

    if (args[0] === 'learn') {
      if (!args[1]) return ctx.reply('Gunakan: /skill learn [nomor]');
      const skillId = resolveSkillInput(ctx.chat.id, args[1]);
      if (!skillId) return ctx.reply('❌ Nomor skill tidak valid. Ketik /skill untuk melihat daftar.');
      const result = service.learn(ctx.chat.id, skillId);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `✅ <b>${result.skill.name}</b> sekarang Rank <b>${result.rank}</b>.`,
        { parse_mode: 'HTML' },
      );
    }

    if (args[0] === 'equip') {
      const slot = Number(args[2]);
      if (!args[1] || !Number.isInteger(slot)) {
        return ctx.reply('Gunakan: /skill equip [nomor] [slot 1-3]');
      }
      const skillId = resolveSkillInput(ctx.chat.id, args[1]);
      if (!skillId) return ctx.reply('❌ Nomor skill tidak valid. Ketik /skill untuk melihat daftar.');
      const result = service.equip(ctx.chat.id, skillId, slot);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(`✅ ${result.skill} dipasang di slot ${result.slot}.`);
    }

    if (args[0] === 'respec') {
      const quote = service.respecQuote(ctx.chat.id);
      if (quote.remaining > 0) {
        return ctx.reply(`⏳ Respec tersedia lagi dalam ${Math.ceil(quote.remaining / 3600)} jam.`);
      }
      if (quote.points === 0) return ctx.reply('Belum ada skill point yang dipakai.');
      if (quote.gold < quote.cost) {
        return ctx.reply(`❌ Respec membutuhkan ${quote.cost}g. Gold-mu: ${quote.gold}g.`);
      }
      const issuedAt = Math.floor(Date.now() / 1000);
      return ctx.reply(
        `<b>Reset seluruh skill?</b>\n` +
        `Skill point kembali: <b>${quote.points}</b>\nBiaya: <b>${quote.cost}g</b>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[
            Markup.button.callback('✅ Konfirmasi', `skill:respec:${ctx.chat.id}:${issuedAt}`),
            Markup.button.callback('❌ Batal', 'skill:respec:cancel'),
          ]]),
        },
      );
    }

    return ctx.reply('Subcommand tersedia: learn, equip, respec.');
  });

  bot.command('build', rateLimitCommand, showSkills);

  bot.action(/^skill:respec:([^:]+):(\d+)$/, async ctx => {
    const userId = String(ctx.chat.id);
    const requestedUserId = ctx.match[1];
    const issuedAt = Number(ctx.match[2]);
    if (userId !== requestedUserId) {
      return ctx.answerCbQuery('Konfirmasi ini bukan milikmu.', { show_alert: true });
    }
    if (Math.floor(Date.now() / 1000) - issuedAt > 5 * 60) {
      return ctx.answerCbQuery('Konfirmasi sudah kedaluwarsa.', { show_alert: true });
    }
    const result = service.respec(userId);
    if (!result.success) return ctx.answerCbQuery(result.reason, { show_alert: true });
    await ctx.answerCbQuery('Skill berhasil di-reset.');
    return ctx.editMessageText(
      `✅ Skill di-reset. <b>${result.refundedPoints}</b> point dikembalikan dengan biaya <b>${result.cost}g</b>.`,
      { parse_mode: 'HTML' },
    );
  });

  bot.action('skill:respec:cancel', ctx => {
    ctx.answerCbQuery('Dibatalkan.');
    return ctx.editMessageText('Respec dibatalkan.').catch(() => {});
  });
}

module.exports = { setupSkills, resolveNumberedId };
