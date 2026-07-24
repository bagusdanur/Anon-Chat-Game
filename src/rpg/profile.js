// src/rpg/profile.js
// Fase 1: /profile — pembuatan karakter & tampilan stats
// Design: Discord game bot style, mobile-friendly, HTML parse_mode
const { Markup } = require('telegraf');
const {
  CLASS_DEFS, xpToNextLevel, calcStats,
  getOrCreateUser, createUser, getCurrentEnergy, getDungeonCooldown,
  getCurrentHp, getEquippedBonus, getEquipped, CLASS_EQUIP_SLOTS
} = require('./db_rpg');
const { progressBar, hpBar, statLine, divider, kvPair, footer, sectionHeader } = require('../format');
const { db } = require('../db');
const { createSkillService } = require('./services/skills');
const { createEquipmentService } = require('./services/equipment');
const { createSocialService } = require('./services/social');
const { formatNumberId, formatStat } = require('./equipment');
const { readGuideState } = require('./guide');
const { determineNextStep } = require('./services/gameplayGuide');

const RARITY_EMOJI = { common: '⚪', uncommon: '🟢', rare: '🔵', epic: '🟣', legendary: '🟠' };
const skillService = createSkillService(db);
const equipmentV2 = createEquipmentService(db);
const socialService = createSocialService(db);
const V2_CATEGORY_LABELS = {
  weapon: 'Senjata',
  staff: 'Tongkat',
  armor: 'Armor',
  accessory: 'Aksesori',
};
const V2_RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

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
  const userId = String(user.telegram_user_id);
  const cls = CLASS_DEFS[user.class_name];
  const nextXp = xpToNextLevel(user.level);
  const energy = getCurrentEnergy(user);
  const cooldownSecs = getDungeonCooldown(user);
  const hp = getCurrentHp(user);
  const equip = getEquippedBonus(user.telegram_user_id);
  const equipped = getEquipped(user.telegram_user_id);
  const v2Bonus = equipmentV2.bonuses(user.telegram_user_id);
  const v2Items = equipmentV2.list(user.telegram_user_id);
  const v2Equipped = v2Items
    .filter(item => item.equipped_slot);
  const skillLoadout = skillService.getCombatLoadout(user.telegram_user_id);
  const alias = socialService.getAlias(userId);
  const guild = socialService.getGuild(userId);
  const party = socialService.getParty(userId);
  const world = db.prepare(`
    SELECT p.current_region_id,p.campaign_chapter,p.exploration_points,r.name AS region_name
    FROM rpg_world_progress p
    LEFT JOIN rpg_regions r ON r.region_id=p.current_region_id
    WHERE p.user_id=?
  `).get(userId);
  const campaign = db.prepare(`
    SELECT d.title,p.status FROM rpg_campaign_progress_v2 p
    JOIN rpg_campaign_definitions d ON d.quest_id=p.quest_id
    WHERE p.user_id=? AND p.status!='claimed'
    ORDER BY d.chapter,d.sort_order LIMIT 1
  `).get(userId);
  const profession = db.prepare(`
    SELECT profession_id,level FROM rpg_professions
    WHERE user_id=? ORDER BY level DESC,xp DESC LIMIT 1
  `).get(userId);
  const season = db.prepare(`
    SELECT s.name,p.points,p.currency FROM rpg_season_progress p
    JOIN rpg_seasons s ON s.season_id=p.season_id
    WHERE p.user_id=? AND s.status='active' ORDER BY s.ends_at LIMIT 1
  `).get(userId);
  const inventoryCount = db.prepare(
    'SELECT COALESCE(SUM(quantity),0) count FROM rpg_inventory WHERE telegram_user_id=?',
  ).get(userId).count;

  const totalAtkBonus = equip.atkBonus + (v2Bonus.atk || 0);
  const totalDefBonus = equip.defBonus + (v2Bonus.def || 0);
  const totalMagicBonus = equip.magicAtkBonus + (v2Bonus.magic_atk || 0);
  const effectiveMaxHp = user.max_hp + (v2Bonus.max_hp || 0);
  const effectiveHp = Math.min(effectiveMaxHp, hp + (v2Bonus.max_hp || 0));
  const effectiveAtk    = user.atk + totalAtkBonus;
  const effectiveDef    = user.def + totalDefBonus;
  const effectiveMagic  = (user.magic_atk || 0) + totalMagicBonus;
  const totalCrit       = Math.min(95, Math.round(((user.crit_rate || 0.05) + equip.critRate + (v2Bonus.crit_rate || 0)) * 100));
  const totalCritMulti  = Math.round(((user.crit_multi || 1.5) + equip.critMulti) * 100);

  const dungeonStatus = cooldownSecs > 0
    ? `⏳ ${Math.ceil(cooldownSecs / 60)}m cooldown`
    : `✅ Siap raid`;

  const dmgType  = cls.damageType === 'magic' ? '🔮 Magic' : '⚔️ Physical';
  const streak   = user.win_streak || 0;
  const nextEMin = energy < 10
    ? (3 - Math.floor(((Date.now() / 1000) - user.energy_last_update) / 60) % 3)
    : 0;

  const guideState = readGuideState(userId);
  const nextStep = determineNextStep(guideState);

  const roundedAtk = Math.round(effectiveAtk);
  const roundedDef = Math.round(effectiveDef);
  const roundedAtkBonus = Math.round(totalAtkBonus);
  const roundedDefBonus = Math.round(totalDefBonus);

  // ── Header (Hero Card) ──────────────────────────────────
  let msg = ``;
  msg += `<b>🎭 ${alias}</b> · ${cls.name} <code>Lv.${user.level}</code>\n`;
  msg += `💰 <b>${user.gold} Gold</b>`;
  if (party) msg += ` · 👥 Party (${party.members.length}/4)`;
  if (guild) msg += ` · 🏛 [${guild.tag}] ${guild.name}`;
  if (streak > 0) msg += ` · 🔥 ${streak}x Win`;
  msg += `\n\n`;

  // ── Bars (Vitals) ────────────────────────────────────────
  const hpFilled  = Math.min(10, Math.round((Math.max(0, effectiveHp) / effectiveMaxHp) * 10));
  const xpFilled  = Math.min(10, Math.round((user.xp / nextXp) * 10));
  const enFilled  = Math.min(10, Math.round((energy / 10) * 10));

  msg += `❤️ <b>HP</b>  ${'█'.repeat(hpFilled)}${'░'.repeat(10 - hpFilled)} <code>${effectiveHp}/${effectiveMaxHp}</code>\n`;
  msg += `✨ <b>XP</b>  ${'█'.repeat(xpFilled)}${'░'.repeat(10 - xpFilled)} <code>${user.xp}/${nextXp}</code>\n`;
  msg += `⚡ <b>EN</b>  ${'█'.repeat(enFilled)}${'░'.repeat(10 - enFilled)} <code>${energy}/10</code>`;
  if (energy < 10) msg += `  <i>(+1 ~${nextEMin}m)</i>`;
  msg += `\n\n`;

  // ── Stats & Attributes ────────────────────────────────────
  msg += `<b>📊 STATS & STATUS</b>\n`;
  msg += `⚔️ ATK <b>${roundedAtk}</b>${roundedAtkBonus > 0 ? `  <i>(+${roundedAtkBonus} eq)</i>` : ''}   `;
  msg += `🛡️ DEF <b>${roundedDef}</b>${roundedDefBonus > 0 ? `  <i>(+${roundedDefBonus} eq)</i>` : ''}\n`;
  if (effectiveMagic > 0) {
    const shownMagic = Math.round(effectiveMagic);
    const shownMagicBonus = Math.round(totalMagicBonus);
    msg += `🔮 Magic <b>${shownMagic}</b>${shownMagicBonus > 0 ? `  <i>(+${shownMagicBonus} eq)</i>` : ''}\n`;
  }
  msg += `💥 Crit <b>${totalCrit}%</b> × <b>${totalCritMulti}%</b>   🎯 ${dmgType}\n`;
  if ((user.phys_resist || 0) > 0 || (user.magic_resist || 0) > 0) {
    msg += `🛡 Resist  Phys <b>${Math.round((user.phys_resist||0)*100)}%</b>  Magic <b>${Math.round((user.magic_resist||0)*100)}%</b>\n`;
  }
  msg += `🏰 Dungeon: ${dungeonStatus}\n\n`;

  // ── Active Objective ──────────────────────────────────────
  msg += `<b>🎯 PETUNJUK LANGKAH BERIKUTNYA</b>\n`;
  msg += `▶️ <code>${nextStep.command}</code> — <b>${nextStep.title}</b>\n`;
  msg += `🌍 ${world?.region_name || 'Pinggiran Aldenmoor'} · 🎒 ${inventoryCount} item`;
  if (profession) msg += ` · 🧰 ${profession.profession_id} Lv.${profession.level}`;
  if (season) msg += ` · 🏆 ${season.points} pts`;
  msg += `\n\n`;

  // ── Equipment ─────────────────────────────────────────────
  msg += `<b>🗡️ EQUIPMENT</b>\n`;
  const allowedSlots = CLASS_EQUIP_SLOTS[user.class_name] || ['weapon', 'staff', 'armor', 'accessory'];
  const slotEmoji = { weapon: '⚔️', staff: '🪄', armor: '🛡️', accessory: '💍' };
  const slotLabel = { weapon: 'Senjata  ', staff: 'Tongkat  ', armor: 'Armor    ', accessory: 'Aksesori ' };

  for (const slot of allowedSlots) {
    msg += `${slotEmoji[slot]} ${slotLabel[slot]}: ${renderSlot(equipped[slot])}\n`;
  }

  const bonusParts = [];
  if (equip.atkBonus > 0)      bonusParts.push(`ATK+${equip.atkBonus}`);
  if (equip.defBonus > 0)      bonusParts.push(`DEF+${equip.defBonus}`);
  if (equip.magicAtkBonus > 0) bonusParts.push(`Magic+${equip.magicAtkBonus}`);
  if (equip.critRate > 0)      bonusParts.push(`Crit+${Math.round(equip.critRate*100)}%`);
  if (bonusParts.length > 0) {
    msg += `✨ <i>Bonus: ${bonusParts.join(' · ')}</i>\n`;
  }

  if (v2Equipped.length > 0) {
    const totalItemPower = v2Equipped.reduce((sum, item) => sum + item.item_power, 0);
    msg += `💠 <b>Gear V2 (${totalItemPower} IP):</b> `;
    const v2Summary = v2Equipped.map(item => {
      const gearNumber = v2Items.findIndex(candidate => candidate.id === item.id) + 1;
      return `<code>[${gearNumber}]</code> ${item.display_name} +${item.upgrade_tier}`;
    }).join(' · ');
    msg += `${v2Summary}\n`;
  }
  msg += `\n`;

  // ── Skill Loadout ──────────────────────────────────────────
  msg += `<b>🌟 SKILL LOADOUT</b>\n`;
  for (let slot = 1; slot <= 3; slot++) {
    const skill = skillLoadout.find(item => item.slot === slot);
    msg += `${slot}️⃣ ${skill ? `<b>${skill.name}</b> (Rank ${skill.rank})` : '<i>(Slot Kosong)</i>'}\n`;
  }

  msg += `\n<i>/guide • /world • /campaign • /inv • /skill • /helprpg</i>`;
  return msg;
}

function setupProfile(bot, { rateLimitCommand }) {
  bot.on('text', async (ctx, next) => {
    if (ctx.message.text.startsWith('/')) return next();
    const pending = db.prepare(
      "SELECT step FROM rpg_character_onboarding WHERE user_id=? AND step='alias'",
    ).get(String(ctx.chat.id));
    if (!pending) return next();

    const result = socialService.setAlias(ctx.chat.id, ctx.message.text.trim());
    if (!result.success) {
      return ctx.reply(
        `❌ ${result.reason}\n\nKirim alias baru tanpa command.\nContoh: <code>RyuKnight</code>`,
        { parse_mode: 'HTML' },
      );
    }
    db.prepare('DELETE FROM rpg_character_onboarding WHERE user_id=?')
      .run(String(ctx.chat.id));
    return ctx.reply(
      `✅ Alias <b>${result.alias}</b> tersimpan!\n\nKarakter siap dimainkan. Ketik /profile atau /rpg.`,
      { parse_mode: 'HTML' },
    );
  });

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

    ctx.reply(renderProfile(user), {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🧭 Buka Guide Lengkap', 'guide:open')]
      ])
    });
  });

  ['ksatria', 'penyihir', 'pencuri'].forEach(className => {
    bot.action(`create_${className}`, async (ctx) => {
      const userId = ctx.chat.id;
      const existing = getOrCreateUser(userId);
      if (existing) return ctx.answerCbQuery('Kamu sudah punya karakter!', { show_alert: true });

      createUser(userId, className);
      const cls = CLASS_DEFS[className];
      const timestamp = Math.floor(Date.now() / 1000);
      db.prepare(`
        INSERT INTO rpg_character_onboarding (user_id,step,created_at,updated_at)
        VALUES (?,'alias',?,?)
        ON CONFLICT(user_id) DO UPDATE SET step='alias',updated_at=excluded.updated_at
      `).run(String(userId), timestamp, timestamp);
      ctx.answerCbQuery(`${cls.name} dipilih!`);
      await ctx.editMessageText(
        `<b>🎉 ${cls.name} — Karakter Dibuat!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Selamat datang, Petualang! ⚔️\n\n` +
        `<b>Langkah terakhir: buat alias karakter anonim.</b>\n` +
        `Alias digunakan di party, guild, ranking, dan aktivitas co-op—bukan nama Telegram.\n\n` +
        `<i>Kirim alias 3–16 karakter (huruf, angka, underscore).</i>`,
        { parse_mode: 'HTML' }
      );
      return ctx.reply(
        'Ketik alias karaktermu sekarang.\nContoh: <code>RyuKnight</code>',
        { parse_mode: 'HTML', ...Markup.forceReply() },
      );
    });
  });
}

module.exports = { setupProfile, renderHpBar, RARITY_EMOJI };
