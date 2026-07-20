// src/rpg/profile.js
// Fase 1: /profile — pembuatan karakter & tampilan stats
// Design: Discord game bot style, mobile-friendly, HTML parse_mode
const { Markup } = require('telegraf');
const {
  CLASS_DEFS, xpToNextLevel, calcStats,
  getOrCreateUser, createUser, getCurrentEnergy, getDungeonCooldown,
  getCurrentHp, getEquippedBonus, getEquipped
} = require('./db_rpg');
const { progressBar, hpBar, statLine, divider, kvPair, footer, sectionHeader } = require('../format');

const RARITY_EMOJI = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟠' };

function renderHpBar(hp, maxHp, len = 8) {
  return progressBar(hp, maxHp, len) + ` ${Math.max(0, hp)}/${maxHp}`;
}

function renderSlot(item) {
  if (!item) return '<i>(Kosong)</i>';
  const tier = item.upgrade_tier > 0 ? ` <b>+${item.upgrade_tier}</b>` : '';
  const rarity = RARITY_EMOJI[item.rarity] || '';
  return `${rarity} ${item.display_name}${tier}`;
}

function renderProfile(user) {
  const cls = CLASS_DEFS[user.class_name];
  const nextXp = xpToNextLevel(user.level);
  const energy = getCurrentEnergy(user);
  const cooldownSecs = getDungeonCooldown(user);
  const hp = getCurrentHp(user);
  const equip = getEquippedBonus(user.telegram_user_id);
  const equipped = getEquipped(user.telegram_user_id);

  const effectiveAtk    = user.atk + equip.atkBonus;
  const effectiveDef    = user.def + equip.defBonus;
  const effectiveMagic  = (user.magic_atk || 0) + equip.magicAtkBonus;
  const totalCrit       = Math.min(95, Math.round(((user.crit_rate || 0.05) + equip.critRate) * 100));
  const totalCritMulti  = Math.round(((user.crit_multi || 1.5) + equip.critMulti) * 100);

  const dungeonStatus = cooldownSecs > 0
    ? `⏳ ${Math.ceil(cooldownSecs / 60)}m cooldown`
    : `✅ Siap raid`;

  const dmgType  = cls.damageType === 'magic' ? '🔮 Magic' : '⚔️ Physical';
  const streak   = user.win_streak || 0;
  const nextEMin = energy < 10
    ? (3 - Math.floor(((Date.now() / 1000) - user.energy_last_update) / 60) % 3)
    : 0;

  // ── Header ──────────────────────────────────
  let msg = ``;
  msg += `<b>${cls.name}</b>  <code>Lv.${user.level}</code>  💰 <b>${user.gold}g</b>\n`;
  if (streak > 0) msg += `🔥 Win Streak: <b>${streak}x</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Bars ────────────────────────────────────
  const hpFilled  = Math.min(10, Math.round((Math.max(0, hp) / user.max_hp) * 10));
  const xpFilled  = Math.min(10, Math.round((user.xp / nextXp) * 10));
  const enFilled  = Math.min(10, Math.round((energy / 10) * 10));

  msg += `❤️ <b>HP</b>  ${'█'.repeat(hpFilled)}${'░'.repeat(10 - hpFilled)} <code>${hp}/${user.max_hp}</code>\n`;
  msg += `✨ <b>XP</b>  ${'█'.repeat(xpFilled)}${'░'.repeat(10 - xpFilled)} <code>${user.xp}/${nextXp}</code>\n`;
  msg += `⚡ <b>EN</b>  ${'█'.repeat(enFilled)}${'░'.repeat(10 - enFilled)} <code>${energy}/10</code>`;
  if (energy < 10) msg += `  <i>(+1 ~${nextEMin}m)</i>`;
  msg += `\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Stats ────────────────────────────────────
  msg += `<b>📊 Stats</b>\n`;
  msg += `⚔️ ATK <b>${effectiveAtk}</b>${equip.atkBonus > 0 ? `  <i>(+${equip.atkBonus} eq)</i>` : ''}   `;
  msg += `🛡️ DEF <b>${effectiveDef}</b>${equip.defBonus > 0 ? `  <i>(+${equip.defBonus} eq)</i>` : ''}\n`;
  if (effectiveMagic > 0) msg += `🔮 Magic <b>${effectiveMagic}</b>${equip.magicAtkBonus > 0 ? `  <i>(+${equip.magicAtkBonus} eq)</i>` : ''}\n`;
  msg += `💥 Crit <b>${totalCrit}%</b> × <b>${totalCritMulti}%</b>   🎯 ${dmgType}\n`;
  if ((user.phys_resist || 0) > 0 || (user.magic_resist || 0) > 0) {
    msg += `🛡 Resist  Phys <b>${Math.round((user.phys_resist||0)*100)}%</b>  Magic <b>${Math.round((user.magic_resist||0)*100)}%</b>\n`;
  }
  msg += `🏰 Dungeon: ${dungeonStatus}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Equipment ────────────────────────────────
  msg += `<b>🗡️ Equipment</b>\n`;
  msg += `⚔️ Weapon   : ${renderSlot(equipped.weapon)}\n`;
  msg += `🪄 Staff    : ${renderSlot(equipped.staff)}\n`;
  msg += `🛡️ Armor    : ${renderSlot(equipped.armor)}\n`;
  msg += `💍 Accessory: ${renderSlot(equipped.accessory)}\n`;

  // Bonus equip ringkas
  const bonusParts = [];
  if (equip.atkBonus > 0)      bonusParts.push(`ATK+${equip.atkBonus}`);
  if (equip.defBonus > 0)      bonusParts.push(`DEF+${equip.defBonus}`);
  if (equip.magicAtkBonus > 0) bonusParts.push(`Magic+${equip.magicAtkBonus}`);
  if (equip.critRate > 0)      bonusParts.push(`Crit+${Math.round(equip.critRate*100)}%`);
  if (bonusParts.length > 0) {
    msg += `<i>Bonus: ${bonusParts.join(' · ')}</i>\n`;
  }

  msg += `\n<i>/equip [item] • /unequip [slot] • /inv</i>`;
  return msg;
}

function setupProfile(bot, { rateLimitCommand }) {
  bot.command('profile', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    let user = getOrCreateUser(userId);

    if (!user) {
      const msg =
        `<b>⚔️ PILIH KELASMU</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Pilih kelas untuk memulai petualangan:\n\n` +
        `⚔️ <b>Ksatria</b> — Tank, HP &amp; DEF tinggi\n` +
        `   Physical fighter, Skill: Tebasan Besar\n\n` +
        `🔥 <b>Penyihir</b> — Magic DPS, burst damage\n` +
        `   Skill: Bola Api (Burn 3 turn)\n\n` +
        `🗡️ <b>Pencuri</b> — Crit tinggi, burst cepat\n` +
        `   Skill: Backstab (100% Crit!)\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Pilih kelasmu di bawah:</i>`;

      return ctx.reply(msg, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⚔️ Ksatria', 'create_ksatria')],
          [Markup.button.callback('🔥 Penyihir', 'create_penyihir')],
          [Markup.button.callback('🗡️ Pencuri', 'create_pencuri')],
        ])
      });
    }

    ctx.reply(renderProfile(user), { parse_mode: 'HTML' });
  });

  ['ksatria', 'penyihir', 'pencuri'].forEach(className => {
    bot.action(`create_${className}`, async (ctx) => {
      const userId = ctx.chat.id;
      const existing = getOrCreateUser(userId);
      if (existing) return ctx.answerCbQuery('Kamu sudah punya karakter!', { show_alert: true });

      createUser(userId, className);
      const cls = CLASS_DEFS[className];
      ctx.answerCbQuery(`${cls.name} dipilih!`);
      ctx.editMessageText(
        `<b>🎉 ${cls.name} — Karakter Dibuat!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Selamat datang, Petualang! ⚔️\n\n` +
        `<b>Langkah pertama:</b>\n` +
        `1. /profile — Lihat stats karakter\n` +
        `2. /hunt — Berburu monster (2 ⚡)\n` +
        `3. /daily — Ambil hadiah harian\n` +
        `4. /helprpg — Panduan lengkap\n\n` +
        `<i>Selamat bertualang! 🎮</i>`,
        { parse_mode: 'HTML' }
      );
    });
  });
}

module.exports = { setupProfile, renderHpBar, RARITY_EMOJI };
