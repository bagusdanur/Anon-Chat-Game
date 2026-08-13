// src/rpg/profile.js
// Fase 1: /profile — pembuatan karakter & tampilan stats
// Design: Discord game bot style, mobile-friendly, HTML parse_mode
const { Markup } = require('telegraf');
const {
  CLASS_DEFS, xpToNextLevel, calcStats,
  getOrCreateUser, createUser, getCurrentEnergy, getDungeonCooldown,
  getCurrentHp, CLASS_EQUIP_SLOTS, MAX_ENERGY
} = require('./db_rpg');
const { progressBar, hpBar, statLine, divider, kvPair, footer, sectionHeader } = require('../format');
const { db } = require('../db');
const { createSkillService } = require('./services/skills');
const { createEquipmentService } = require('./services/equipment');
const { createSocialService } = require('./services/social');
const { formatNumberId, formatStat, gearAdvice } = require('./equipment');
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

  const totalAtkBonus = v2Bonus.atk || 0;
  const totalDefBonus = v2Bonus.def || 0;
  const totalMagicBonus = v2Bonus.magic_atk || 0;
  const effectiveMaxHp = user.max_hp + (v2Bonus.max_hp || 0);
  const effectiveHp = Math.min(effectiveMaxHp, hp + (v2Bonus.max_hp || 0));
  const effectiveAtk    = user.atk + totalAtkBonus;
  const effectiveDef    = user.def + totalDefBonus;
  const effectiveMagic  = (user.magic_atk || 0) + totalMagicBonus;
  const totalCrit       = Math.min(95, Math.round(((user.crit_rate || 0.05) + (v2Bonus.crit_rate || 0)) * 100));
  const totalCritMulti  = Math.round((user.crit_multi || 1.5) * 100);

  const dungeonStatus = cooldownSecs > 0
    ? `⏳ ${Math.ceil(cooldownSecs / 60)}m cooldown`
    : `✅ Siap raid`;

  const dmgType  = cls.damageType === 'magic' ? '🔮 Magic' : '⚔️ Physical';
  const streak   = user.win_streak || 0;
  const nextEMin = energy < MAX_ENERGY
    ? (3 - Math.floor(((Date.now() / 1000) - user.energy_last_update) / 60) % 3)
    : 0;

  const guideState = readGuideState(userId);
  const nextStep = determineNextStep(guideState);

  const roundedAtk = Math.round(effectiveAtk);
  const roundedDef = Math.round(effectiveDef);
  const roundedAtkBonus = Math.round(totalAtkBonus);
  const roundedDefBonus = Math.round(totalDefBonus);

  // ── Header ──────────────────────────────────
  let msg = ``;
  msg += `<b>🎭 ${alias}</b>\n`;
  msg += `${cls.name}  <code>Lv.${user.level}</code>  💰 <b>${formatNumberId(user.gold, 0)}g</b>\n`;
  if (streak > 0) msg += `🔥 Win Streak: <b>${streak}x</b>\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Bars ────────────────────────────────────
  const hpFilled  = Math.min(10, Math.round((Math.max(0, effectiveHp) / effectiveMaxHp) * 10));
  const xpFilled  = Math.min(10, Math.round((user.xp / nextXp) * 10));
  const enFilled  = Math.min(10, Math.round((energy / MAX_ENERGY) * 10));

  msg += `❤️ <b>HP</b>  ${'█'.repeat(hpFilled)}${'░'.repeat(10 - hpFilled)} <code>${formatNumberId(effectiveHp)}/${formatNumberId(effectiveMaxHp)}</code>\n`;
  msg += `✨ <b>XP</b>  ${'█'.repeat(xpFilled)}${'░'.repeat(10 - xpFilled)} <code>${user.xp}/${nextXp}</code>\n`;
  msg += `⚡ <b>EN</b>  ${'█'.repeat(enFilled)}${'░'.repeat(10 - enFilled)} <code>${energy}/${MAX_ENERGY}</code>`;
  if (energy < MAX_ENERGY) msg += `  <i>(+1 ~${nextEMin}m)</i>`;
  msg += `\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Stats ────────────────────────────────────
  msg += `<b>📊 Stats</b>\n`;
  msg += `⚔️ ATK <b>${formatNumberId(effectiveAtk)}</b>${totalAtkBonus > 0 ? `  <i>(+${formatNumberId(totalAtkBonus)} eq)</i>` : ''}   `;
  msg += `🛡️ DEF <b>${formatNumberId(effectiveDef)}</b>${totalDefBonus > 0 ? `  <i>(+${formatNumberId(totalDefBonus)} eq)</i>` : ''}\n`;
  if (effectiveMagic > 0) {
    const shownMagic = formatNumberId(effectiveMagic);
    const shownMagicBonus = formatNumberId(totalMagicBonus);
    msg += `🔮 Magic <b>${shownMagic}</b>${totalMagicBonus > 0 ? `  <i>(+${shownMagicBonus} eq)</i>` : ''}\n`;
  }
  msg += `💥 Crit <b>${totalCrit}%</b> × <b>${totalCritMulti}%</b>   🎯 ${dmgType}\n`;
  if ((user.phys_resist || 0) > 0 || (user.magic_resist || 0) > 0) {
    msg += `🛡 Resist  Phys <b>${Math.round((user.phys_resist||0)*100)}%</b>  Magic <b>${Math.round((user.magic_resist||0)*100)}%</b>\n`;
  }
  msg += `🏰 Dungeon: ${dungeonStatus}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Equipment ────────────────────────────────
  const allowedSlots = CLASS_EQUIP_SLOTS[user.class_name] || ['weapon', 'staff', 'armor', 'accessory'];
  const slotEmoji = { weapon: '⚔️', staff: '🪄', armor: '🛡️', accessory: '💍' };
  const slotLabel = { weapon: 'Weapon', staff: 'Staff', armor: 'Armor', accessory: 'Accessory' };

  msg += `<b>🗡️ Perlengkapan Aktif</b>\n`;
  for (const slot of allowedSlots) {
    const forged = v2Equipped.find(item => item.equipped_slot === slot);
    const shown = forged
      ? `<b>${forged.display_name}</b> +${forged.upgrade_tier} · Lv.${forged.item_level} · ${forged.item_power} IP`
      : '<i>(Kosong)</i>';
    msg += `${slotEmoji[slot]} ${slotLabel[slot].padEnd(9)}: ${shown}\n`;
  }

  // Bonus equip ringkas
  const bonusParts = [];
  if (v2Bonus.atk > 0)         bonusParts.push(`ATK+${formatNumberId(v2Bonus.atk)}`);
  if (v2Bonus.def > 0)         bonusParts.push(`DEF+${formatNumberId(v2Bonus.def)}`);
  if (v2Bonus.magic_atk > 0)   bonusParts.push(`Magic+${formatNumberId(v2Bonus.magic_atk)}`);
  if (v2Bonus.crit_rate > 0)   bonusParts.push(`Crit+${formatNumberId(v2Bonus.crit_rate*100, 0)}%`);
  if (bonusParts.length > 0) {
    msg += `<i>Bonus: ${bonusParts.join(' · ')}</i>\n`;
  }

  const totalUpgradeTier = v2Equipped.reduce((sum, item) => sum + Number(item.upgrade_tier || 0), 0);
  const weakestGear = v2Equipped.slice().sort((a, b) => a.item_power - b.item_power)[0];
  const classPriority = user.class_name === 'penyihir'
    ? 'Magic, Crit, lalu DEF/HP'
    : user.class_name === 'pencuri'
      ? 'ATK, Crit, lalu HP'
      : 'ATK, DEF, lalu HP';
  msg += `<b>🧩 Build Efektif</b> · Prioritas: <i>${classPriority}</i>\n`;
  msg += `Gear aktif ${v2Equipped.length}/${allowedSlots.length} · Total upgrade +${totalUpgradeTier}`;
  if (weakestGear) {
    const weakestAdvice = gearAdvice(user.class_name, weakestGear, weakestGear);
    msg += ` · Terlemah: <b>${weakestGear.display_name}</b> (${weakestGear.item_power} IP)`;
    msg += `\n<i>${weakestAdvice.action} Buka /gear untuk pengganti.</i>`;
  } else {
    msg += `\n<i>Forge dan pasang equipment agar build terasa pada dungeon.</i>`;
  }
  msg += `\n`;

  if (v2Equipped.length > 0) {
    const totalItemPower = v2Equipped.reduce((sum, item) => sum + item.item_power, 0);
    msg += `\n<b>💠 Detail Equipment</b> · Total <b>${totalItemPower} IP</b>\n`;
    for (const item of v2Equipped) {
      const gearNumber = v2Items.findIndex(candidate => candidate.id === item.id) + 1;
      const bonuses = item.affixes.length
        ? item.affixes.map(affix => formatStat(affix.stat_key, affix.stat_value)).join(' · ')
        : 'Tanpa bonus acak';
      const filledSockets = item.sockets.filter(socket => socket.gem_item_id).length;
      const socketInfo = item.sockets.length
        ? `${filledSockets}/${item.sockets.length} terisi`
        : 'tidak ada';
      const binding = item.bind_status === 'account_bound' ? 'Terikat' : 'Bisa dijual';
      msg += `✅ <code>[${gearNumber}]</code> <b>${item.display_name}</b> +${item.upgrade_tier}\n`;
      msg += `   ${V2_CATEGORY_LABELS[item.category] || item.category} · ` +
        `${V2_RARITY_LABELS[item.rarity] || item.rarity} · ` +
        `Item Lv.${item.item_level} · <b>${item.item_power} IP</b> (skor) · Q${item.quality}/100\n`;
      msg += `   🎲 ${bonuses}\n`;
      msg += `   💎 Socket ${socketInfo} · 🔒 ${binding}`;
      if (item.set_id) msg += ` · 🧩 Set ${item.set_id}`;
      msg += `\n`;
    }
  }

  msg += `\n<b>🌟 Skill Loadout</b>\n`;
  for (let slot = 1; slot <= 3; slot++) {
    const skill = skillLoadout.find(item => item.slot === slot);
    msg += `${slot}️⃣ ${skill ? `<b>${skill.name}</b> · Rank ${skill.rank}` : '<i>(Kosong)</i>'}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Ringkasan progres & sosial ─────────────────
  msg += `<b>🧭 Ringkasan</b>\n`;
  msg += `🌍 ${world?.region_name || 'Pinggiran Aldenmoor'} · Chapter ${world?.campaign_chapter || 1}`;
  if (world?.exploration_points) msg += ` · Jelajah ${world.exploration_points}`;
  msg += `\n`;
  const campaignSummary = campaign
    ? `${campaign.title} (${campaign.status})`
    : nextStep.command === '/season'
      ? 'Campaign utama selesai'
      : 'Campaign siap dilanjutkan';
  msg += `📜 ${campaignSummary}\n`;
  msg += `🎒 ${inventoryCount} item`;
  if (profession) msg += ` · 🧰 ${profession.profession_id} Lv.${profession.level}`;
  msg += `\n`;
  msg += `🏛 ${guild ? `[${guild.tag}] ${guild.name} · ${guild.role}` : 'Belum bergabung guild'}`;
  msg += ` · 👥 ${party ? `${party.members.length} anggota` : 'Solo'}\n`;
  if (season) {
    msg += `🏆 ${season.name}: ${season.points} pts · 🪙 ${season.currency}\n`;
  }
  msg += `━━━━━━━━━━━━━━━━━━━━\n`;

  // ── Guide Step Onboarding (At the Bottom) ──
  msg += `<b>🧭 LANGKAH BERIKUTNYA</b>\n`;
  msg += `▶️ <b>${nextStep.title}</b> · <code>${nextStep.command}</code>\n`;
  msg += `   <i>${nextStep.detail}</i>\n`;

  msg += `\n<i>/guide • /world • /campaign • /party • /guild\n/skill • /gear • /inv • /helprpg</i>`;
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
        `<b>Langkah terakhir: buat alias karakter karakter.</b>\n` +
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

module.exports = { setupProfile, renderProfile, renderHpBar, RARITY_EMOJI };
