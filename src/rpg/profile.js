// src/rpg/profile.js
// Fase 1: /profile — pembuatan karakter & tampilan stats
const { Markup } = require('telegraf');
const {
  CLASS_DEFS, xpToNextLevel, calcStats,
  getOrCreateUser, createUser, getCurrentEnergy, getDungeonCooldown, getCurrentHp, getEquipmentBonus
} = require('./db_rpg');
const { progressBar, hpBar, statLine, divider, sectionHeader, kvPair } = require('../format');

const RARITY_EMOJI = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟠' };

function renderXpBar(xp, nextXp, len = 10) {
  return progressBar(xp, nextXp, len) + ` ${xp}/${nextXp}`;
}

function renderHpBar(hp, maxHp, len = 8) {
  return progressBar(hp, maxHp, len) + ` ${Math.max(0, hp)}/${maxHp}`;
}

function renderProfile(user) {
  const cls = CLASS_DEFS[user.class_name];
  const nextXp = xpToNextLevel(user.level);
  const energy = getCurrentEnergy(user);
  const cooldownSecs = getDungeonCooldown(user);
  const hp = getCurrentHp(user);
  const nextEnergyMin = energy < 10 ? (3 - Math.floor(((Date.now() / 1000) - user.energy_last_update) / 60) % 3) : 0;
  const equip = getEquipmentBonus(user.telegram_user_id);
  const effectiveAtk = user.atk + equip.atkBonus;
  const effectiveDef = user.def + equip.defBonus;
  const effectiveMagicAtk = (user.magic_atk || 0) + equip.magicAtkBonus;
  const totalCritRate = Math.min(0.95, (user.crit_rate || 0.05) + equip.critRate);
  const totalCritMulti = (user.crit_multi || 1.5) + equip.critMulti;

  const dungeonStatus = cooldownSecs > 0
    ? `⏳ Cooldown ${Math.ceil(cooldownSecs / 60)} menit`
    : `✅ Siap raid!`;

  const dmgType = cls.damageType === 'magic' ? '🔮 Magic' : '⚔️ Physical';
  const streak = user.win_streak || 0;

  // Build clean profile card
  let msg = `${cls.name} — *Profil Petualang*\n`;
  msg += `${divider('═', 30)}\n\n`;

  // Progress bars
  msg += `${hpBar('❤️', 'HP', hp, user.max_hp, 8)}\n`;
  msg += `${hpBar('✨', 'XP', user.xp, nextXp, 8)}\n`;
  msg += `${hpBar('⚡', 'Energi', energy, 10, 8)}\n\n`;

  // Stats
  msg += `${divider('─', 30)}\n`;
  msg += `**Stats:**\n`;
  msg += `${statLine('⚔️', 'ATK', effectiveAtk, equip.atkBonus > 0 ? `+${equipBonus} eq` : '')}\n`;
  msg += `${statLine('🛡️', 'DEF', effectiveDef, equip.defBonus > 0 ? `+${equip.defBonus} eq` : '')}\n`;
  msg += `${statLine('🔮', 'Magic', effectiveMagicAtk > 0 ? effectiveMagicAtk : '-')}\n`;
  msg += `${statLine('🎯', 'Damage', dmgType)}\n`;
  msg += `${statLine('💥', 'Crit', `${Math.round(totalCritRate * 100)}% / ${Math.round(totalCritMulti * 100)}%`)}\n`;
  msg += `${statLine('🛡️', 'Resist', `Phys ${Math.round((user.phys_resist || 0) * 100)}% | Magic ${Math.round((user.magic_resist || 0) * 100)}%`)}\n\n`;

  // Info
  msg += `${divider('─', 30)}\n`;
  msg += `💰 Gold: *${user.gold}g*\n`;
  msg += `🏆 Level: *${user.level}*\n`;
  if (streak > 0) msg += `🔥 Win Streak: *${streak}x*\n`;
  msg += `🏰 Dungeon: ${dungeonStatus}\n`;

  if (energy < 10) {
    msg += `${footer(`+1 energi dalam ~${nextEnergyMin} menit`)}`;
  }

  return msg;
}

function setupProfile(bot, { rateLimitCommand }) {
  bot.command('profile', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    let user = getOrCreateUser(userId);

    if (!user) {
      // Belum punya karakter — tampilkan pilihan kelas
      const msg = `${divider('═', 30)}\n` +
        `**⚔️ PILIH KELASMU**\n` +
        `${divider('═', 30)}\n\n` +
        `Pilih kelas untuk memulai petualangan:\n\n` +
        `${kvPair('⚔️', 'Ksatria', 'Physical fighter, HP & DEF tinggi')}\n` +
        `${kvPair('🔥', 'Penyihir', 'Magic DPS, ATK magic tinggi')}\n` +
        `${kvPair('🗡️', 'Pencuri', 'Physical burst, Crit tinggi')}\n\n` +
        `${divider('─', 30)}\n` +
        `_Pilih kelasmu:_`;

      const buttons = [
        [Markup.button.callback('⚔️ Ksatria', 'create_ksatria')],
        [Markup.button.callback('🔥 Penyihir', 'create_penyihir')],
        [Markup.button.callback('🗡️ Pencuri', 'create_pencuri')],
      ];

      return ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
    }

    // Sudah punya karakter — tampilkan profile
    const profileMsg = renderProfile(user);
    ctx.reply(profileMsg, { parse_mode: 'Markdown' });
  });

  // Create character handlers
  ['ksatria', 'penyihir', 'pencuri'].forEach(className => {
    bot.action(`create_${className}`, async (ctx) => {
      const userId = ctx.chat.id;
      const existing = getOrCreateUser(userId);
      if (existing) {
        return ctx.answerCbQuery('Kamu sudah punya karakter!', { show_alert: true });
      }

      createUser(userId, className);
      const cls = CLASS_DEFS[className];
      ctx.answerCbQuery(`${cls.name} dipilih!`);
      ctx.editMessageText(
        `${divider('═', 30)}\n` +
        `**${cls.name} — Karakter Dibuat!**\n` +
        `${divider('═', 30)}\n\n` +
        `Selamat datang, Petualang! 🎉\n\n` +
        `Kamu sekarang adalah **${cls.name}**.\n\n` +
        `${divider('─', 30)}\n` +
        `**Langkah selanjutnya:**\n` +
        `${kvPair('1', '/profile', 'Lihat stats karakter')}\n` +
        `${kvPair('2', '/hunt', 'Berburu monster (2 energi)')}\n` +
        `${kvPair('3', '/shop', 'Beli item')}\n` +
        `${kvPair('4', '/helprpg', 'Panduan lengkap')}\n\n` +
        `${footer('Selamat bertualang! 🎮⚔️')}`,
        { parse_mode: 'Markdown' }
      );
    });
  });
}

module.exports = { setupProfile, renderHpBar, RARITY_EMOJI };
