// src/rpg/profile.js
// Fase 1: /profile — pembuatan karakter & tampilan stats
const { Markup } = require('telegraf');
const {
  CLASS_DEFS, xpToNextLevel, calcStats,
  getOrCreateUser, createUser, getCurrentEnergy, getDungeonCooldown, getCurrentHp, getEquipmentBonus
} = require('./db_rpg');

const RARITY_EMOJI = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟠' };

function renderXpBar(xp, nextXp, len = 10) {
  const filled = Math.min(len, Math.round((xp / nextXp) * len));
  return '🟦'.repeat(filled) + '⬛'.repeat(len - filled) + ` ${xp}/${nextXp}`;
}

function renderHpBar(hp, maxHp, len = 8) {
  const filled = Math.min(len, Math.round((Math.max(0, hp) / maxHp) * len));
  return '🟩'.repeat(filled) + '⬛'.repeat(len - filled) + ` ${Math.max(0, hp)}/${maxHp}`;
}

function renderProfile(user) {
  const cls = CLASS_DEFS[user.class_name];
  const nextXp = xpToNextLevel(user.level);
  const energy = getCurrentEnergy(user);
  const cooldownSecs = getDungeonCooldown(user);
  const hp = getCurrentHp(user);
  const nextEnergyMin = energy < 10 ? (3 - Math.floor(((Date.now() / 1000) - user.energy_last_update) / 60) % 3) : 0;
  const { atkBonus, defBonus } = getEquipmentBonus(user.telegram_user_id);
  const effectiveAtk = user.atk + atkBonus;
  const effectiveDef = user.def + defBonus;

  const dungeonStatus = cooldownSecs > 0
    ? `⏳ Cooldown ${Math.ceil(cooldownSecs / 60)} menit`
    : `✅ Siap raid!`;

  const atkStr = atkBonus > 0 ? `${effectiveAtk} _(+${atkBonus} eq)_` : `${effectiveAtk}`;
  const defStr = defBonus > 0 ? `${effectiveDef} _(+${defBonus} eq)_` : `${effectiveDef}`;

  return (
    `${cls.name} — *Profil Petualang* 📖\n\n` +
    `🏆 Level: *${user.level}*\n` +
    `✨ XP: ${renderXpBar(user.xp, nextXp)}\n` +
    `❤️ HP: ${renderHpBar(hp, user.max_hp)}\n` +
    `⚔️ ATK: ${atkStr}   🛡️ DEF: ${defStr}\n` +
    `💰 Gold: ${user.gold}g\n\n` +
    `⚡ Energi: ${energy}/10${energy < 10 ? ` _(+1 dalam ~${nextEnergyMin} mnt)_` : ''}\n` +
    `🏰 Dungeon: ${dungeonStatus}\n`
  );
}

function setupProfile(bot, { rateLimitCommand }) {
  // Pending character creation map (in-memory per user)
  const pendingClass = new Map();

  bot.command('profile', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const user = getOrCreateUser(userId);

    if (!user) {
      // Belum punya karakter — mulai pembuatan karakter
      const msg =
        `⚔️ *Selamat Datang, Petualang!* ⚔️\n\n` +
        `Kamu belum punya karakter. Pilih kelasmu untuk memulai petualangan:\n\n` +
        `*⚔️ Ksatria* — HP tinggi, DEF kuat. _Trait: -10% damage di dungeon._\n` +
        `*🔥 Penyihir* — ATK tinggi, HP rendah. _Trait: +15% XP dari /hunt._\n` +
        `*🗡️ Pencuri* — Seimbang. _Trait: +gold bonus seiring naik level._`;
      return ctx.reply(msg, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⚔️ Ksatria', 'rpg:create:ksatria')],
          [Markup.button.callback('🔥 Penyihir', 'rpg:create:penyihir')],
          [Markup.button.callback('🗡️ Pencuri', 'rpg:create:pencuri')],
        ])
      });
    }

    ctx.reply(renderProfile(user), { parse_mode: 'Markdown' });
  });

  bot.action(/^rpg:create:(ksatria|penyihir|pencuri)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const className = ctx.match[1];

    if (getOrCreateUser(userId)) {
      return ctx.answerCbQuery('Kamu sudah punya karakter!', { show_alert: true });
    }

    const user = createUser(userId, className);
    const cls = CLASS_DEFS[className];
    ctx.answerCbQuery(`${cls.name} dipilih!`);
    ctx.editMessageText(
      `✅ Karakter berhasil dibuat!\n\n${renderProfile(user)}\n\n` +
      `_Gunakan /hunt, /fish, /mine untuk grinding. /daily untuk reward harian. /dungeon saat bersama partner!_`,
      { parse_mode: 'Markdown' }
    );
  });
}

module.exports = { setupProfile, renderProfile, renderHpBar, renderXpBar, RARITY_EMOJI };
