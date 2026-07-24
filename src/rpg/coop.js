// src/rpg/coop.js
// Fase 5: /dungeon — co-op raid boss turn-based
const { Markup } = require('telegraf');
const { getGameSettings } = require('./config');
const {
  getOrCreateUser, getDungeonCooldown, setDungeonCooldown,
  addXp, addGold, addItem, updateHp, getCurrentHp,
  createDungeonRun, finalizeDungeonRun, CLASS_DEFS, getEquipmentBonus,
  calcPhysicalDamage, calcMagicDamage, rollCrit,
  addStatusEffect, tickStatusEffects, hasStatusEffect, clearStatusEffects,
  incrementQuestProgress
} = require('./db_rpg');
const { renderHpBar } = require('./profile');
const { db } = require('../db');
const { createSkillService } = require('./services/skills');
const { createEquipmentService } = require('./services/equipment');
const {
  tickSkillCooldowns, getSkillCooldown, findLoadoutSkill, resolveCombatSkill,
} = require('./services/combatSkills');

const skillService = createSkillService(db);
const equipmentV2 = createEquipmentService(db);

// In-memory raid state keyed by pairKey
let botRef = null;
const raidSessions = new Map();
const dungeonInvites = new Map();
const RAID_SESSION_TIMEOUT = 5 * 60 * 1000;
const RAID_INVITE_TIMEOUT = 10 * 60 * 1000;

function getPairKey(a, b) {
  return [a.toString(), b.toString()].sort().join(':');
}

const fs = require('fs');
const path = require('path');

function getBossConfig() {
  try {
    const configPath = path.join(__dirname, '../../data/rpg_bosses.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')).bosses;
    }
  } catch (e) {
    console.error('Failed to load rpg_bosses.json:', e);
  }
  return []; // Fallback empty if config deleted
}

function getBossTier(avgLevel) {
  const bosses = getBossConfig();
  if (!bosses.length) return null;
  return bosses.find(t => avgLevel >= t.minAvgLv && avgLevel <= t.maxAvgLv) || bosses[0];
}

function getBossTierById(tierId) {
  const bosses = getBossConfig();
  if (!bosses.length) return null;
  return bosses.find(t => t.tier === tierId) || bosses[0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== COMBAT RESOLUTION (Physical/Magic/Crit/Status) =====
function resolveTurn(raid, actions) {
  const logs = [];
  const boss = raid.boss;
  const bossDefender = { def: boss.def, phys_resist: boss.physResist || 0, magic_resist: boss.magicResist || 0 };
  Object.values(raid.players).forEach(tickSkillCooldowns);

  // Tick burn boss (in-memory, boss bukan user DB)
  if (raid.boss.burnTurns > 0 && raid.boss.burnDmg > 0) {
    raid.boss.hp = Math.max(0, raid.boss.hp - raid.boss.burnDmg);
    logs.push(`🔥 ${boss.name} terbakar! *-${raid.boss.burnDmg} HP* (burn)`);
    raid.boss.burnTurns--;
    if (raid.boss.burnTurns <= 0) {
      raid.boss.burnDmg = 0;
    }
  }

  // Tick status effects untuk semua pemain
  for (const [uid, player] of Object.entries(raid.players)) {
    if (!player.alive) continue;
    const effectLogs = tickStatusEffects(uid);
    for (const log of effectLogs) {
      // Extract damage from log
      const dmgMatch = log.match(/-(\d+) HP/);
      if (dmgMatch) {
        const dmg = parseInt(dmgMatch[1]);
        player.hp = Math.max(0, player.hp - dmg);
        if (player.hp <= 0) {
          player.alive = false;
          logs.push(`${log} → 💀 ${player.className} tumbang!`);
        } else {
          logs.push(log);
        }
      }
    }
    // Stun check — skip turn jika stunned
    if (hasStatusEffect(uid, 'stun')) {
      logs.push(`⚡ ${player.className} STUN! Melewatkan turn.`);
      continue;
    }
  }

  // Player actions
  for (const [uid, action] of Object.entries(actions)) {
    if (action.type === 'dead') continue;
    const player = raid.players[uid];
    if (!player || !player.alive) continue;
    const cls = CLASS_DEFS[player.classId];

    if (action.type === 'attack') {
      // Basic attack — tipe damage sesuai kelas
      // Penyihir: pakai magic_atk (bukan atk) agar basic attack relevan
      const baseDmg = cls.damageType === 'magic'
        ? (player.magicAtk || player.atk)
        : player.atk + (player.atkBonus || 0);
      let dmg;
      if (cls.damageType === 'magic') {
        dmg = calcMagicDamage(player, bossDefender, baseDmg);
      } else {
        dmg = calcPhysicalDamage(player, bossDefender, baseDmg);
      }
      // Crit roll
      const { isCrit, multiplier } = rollCrit(player.critRate || 0.05, player.critMulti || 1.5);
      dmg = Math.floor(dmg * multiplier);
      boss.hp = Math.max(0, boss.hp - dmg);
      const critText = isCrit ? ' 💥 CRIT!' : '';
      const typeIcon = cls.damageType === 'magic' ? '🔮' : '⚔️';
      logs.push(`${typeIcon} ${player.className}: menyerang! *-${dmg} HP* bos${critText}`);

    } else if (action.type === 'skill' && action.skillId) {
      const skill = findLoadoutSkill(player, action.skillId);
      if (!skill) {
        logs.push(`⚠️ ${player.className}: skill loadout tidak valid.`);
        continue;
      }
      const result = resolveCombatSkill({
        attacker: player,
        defender: bossDefender,
        skill,
        calcPhysicalDamage,
        calcMagicDamage,
        rollCrit,
      });
      boss.hp = Math.max(0, boss.hp - result.damage);
      if (result.status?.type === 'burn') {
        boss.burnDmg = Math.max(boss.burnDmg || 0, result.status.power);
        boss.burnTurns = Math.max(boss.burnTurns || 0, result.status.turns);
      }
      if (bossDefender.weakenPower) boss.weakenPower = bossDefender.weakenPower;
      logs.push(`${player.icon} ${player.className}: ${result.log}`);

    } else if (action.type === 'skill') {
      // Skill — damage type sesuai kelas + status effect
      const baseDmg = cls.damageType === 'magic' ? (player.magicAtk || player.atk) : (player.atk + (player.atkBonus || 0));
      let dmg;
      const skillMulti = cls.skillMulti || 2.0;

      if (cls.damageType === 'magic') {
        // Penyihir: Bola Api — magic damage + burn (in-memory pada boss)
        dmg = calcMagicDamage(player, bossDefender, baseDmg, skillMulti);
        // BAL-04: Nerf burn dari 15% ke 10% per tick agar tidak terlalu dominan
        raid.boss.burnDmg = Math.floor(dmg * 0.10);
        raid.boss.burnTurns = (raid.boss.burnTurns || 0) + 3;
        logs.push(`🔥 ${player.className}: ${cls.skillName}! *-${dmg} HP* bos + 🔥 Burn 3 turn!`);

      } else if (player.classId === 'pencuri') {
        // Pencuri: Backstab — physical + 100% crit
        dmg = calcPhysicalDamage(player, bossDefender, baseDmg, skillMulti);
        const critDmg = Math.floor(dmg * (player.critMulti || 2.0));
        boss.hp = Math.max(0, boss.hp - critDmg);
        logs.push(`🗡️ ${player.className}: ${cls.skillName}! *-${critDmg} HP* bos 💥 100% CRIT!`);
        player.skillCooldown = 4;
        continue; // skip normal damage apply
      } else {
        // Ksatria: Tebasan Besar — physical + 10% DEF penetrate
        dmg = calcPhysicalDamage(player, bossDefender, baseDmg, skillMulti, 0.10);
        logs.push(`⚔️ ${player.className}: ${cls.skillName}! *-${dmg} HP* bos (DEF -10%)!`);
      }

      boss.hp = Math.max(0, boss.hp - dmg);
      player.skillCooldown = 3;

    } else if (action.type === 'defend') {
      player.defending = true;
      // Ksatria: Shield effect 1 turn
      addStatusEffect(uid, 'shield', 1, 0);
      logs.push(`🛡️ ${player.className}: mengambil posisi bertahan! +🛡️ Shield 1 turn`);

    } else if (action.type === 'item') {
      const healAmt = Math.floor(player.maxHp * 0.15);
      player.hp = Math.min(player.maxHp, player.hp + healAmt);
      // Bersihkan status effect negatif
      clearStatusEffects(uid);
      logs.push(`🧪 ${player.className}: minum ramuan! *+${healAmt} HP* + Bersihkan debuff`);
    }

    // Cooldown tick
    if (player.skillCooldown > 0 && action.type !== 'skill') player.skillCooldown--;
  }

  if (boss.hp <= 0) return logs;

  // Boss attack
  let bossAtk = randInt(...boss.atkRange);
  if (boss.weakenPower) {
    bossAtk = Math.max(1, Math.floor(bossAtk * (1 - boss.weakenPower)));
    boss.weakenPower = 0;
  }
  const isTelegraph = raid.turnNumber % 3 === 0;

  // Enrage at 50% HP
  const enraged = boss.hp <= Math.floor(boss.maxHp / 2) && !raid.enrageAnnounced;
  if (enraged) {
    raid.enrageAnnounced = true;
    boss.atkRange[0] = Math.floor(boss.atkRange[0] * 1.3);
    boss.atkRange[1] = Math.floor(boss.atkRange[1] * 1.3);
    logs.push(`😡 <b>${boss.name} MENGAMUK! ATK meningkat 30%!</b>`);
  }

  for (const [uid, player] of Object.entries(raid.players)) {
    if (!player.alive) continue;
    let dmg = Math.max(1, bossAtk - Math.floor(player.def / 2) + randInt(-2, 3));
    // Shield: -50% damage — cek uid bukan player.classId
    if (hasStatusEffect(uid, 'shield') || player.defending) {
      dmg = Math.floor(dmg * (1 - (player.guardReduction || 0.5)));
      player.defending = false;
      player.guardReduction = 0;
    }
    if (player.shieldPercent) {
      dmg = Math.floor(dmg * (1 - player.shieldPercent));
      player.shieldPercent = 0;
    }
    const protector = Object.values(raid.players)
      .find(other => other !== player && other.alive && other.provoking);
    if (protector) dmg = Math.floor(dmg * 0.5);
    // Ksatria trait: -10% damage
    if (player.classId === 'ksatria') dmg = Math.floor(dmg * 0.9);
    // Apply player phys resist
    dmg = Math.max(1, Math.floor(dmg * (1 - (player.physResist || 0))));
    player.hp = Math.max(0, player.hp - dmg);
    if (player.hp <= 0) {
      player.alive = false;
      logs.push(`💀 ${player.className} tumbang kena serangan bos!`);
    } else {
      logs.push(`👹 ${boss.name} menyerang ${player.className}: *-${dmg} HP*`);
    }
  }
  Object.values(raid.players).forEach(player => { player.provoking = false; });

  if (isTelegraph && boss.hp > 0) {
    logs.push(`⚠️ <b>${boss.name} bersiap untuk serangan berat! Gunakan BERTAHAN!</b>`);
  }

  raid.turnNumber++;
  return logs;
}

// ===== SEND COMBAT UI =====
function sendCombatUI(bot, raid, extraLogs = []) {
  const { chatIdA, chatIdB, pairKey, boss, players, turnNumber } = raid;
  const allLogs = [...extraLogs, ...raid.pendingLogs];
  raid.pendingLogs = [];

  // === HEADER ===
  let msg = `━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `⚔️ <b>TURN ${turnNumber}</b> — ${boss.name}\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

  // === BOSS STATUS ===
  msg += `👹 <b>${boss.name}</b>\n`;
  msg += `${renderHpBar(boss.hp, boss.maxHp, 12)}\n`;
  msg += `🛡️ Phys ${Math.round((boss.physResist||0)*100)}% | 🔮 Magic ${Math.round((boss.magicResist||0)*100)}%\n\n`;

  // === PARTY STATUS ===
  msg += `👥 <b>PARTY:</b>\n`;
  for (const [uid, p] of Object.entries(players)) {
    if (p.alive) {
      const cls = CLASS_DEFS[p.classId];
      const dmgType = cls.damageType === 'magic' ? '🔮' : '⚔️';
      const critPct = Math.round((p.critRate || 0.05) * 100);
      msg += `${p.icon} <b>${p.className}</b> ${dmgType}\n`;
      msg += `   ${renderHpBar(p.hp, p.maxHp, 8)}\n`;
      const activeCooldowns = Object.values(p.skillCooldowns || {}).filter(cd => cd > 0);
      const cooldownText = p.skillLoadout?.length
        ? (activeCooldowns.length ? activeCooldowns.join('/') : 'ready')
        : p.skillCooldown;
      msg += `   ⚡ CD: ${cooldownText} | 💥 Crit: ${critPct}%\n`;
    } else {
      msg += `${p.icon} <b>${p.className}</b>: 💀 Tumbang\n`;
    }
  }

  // === TURN LOG ===
  if (allLogs.length > 0) {
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📝 <b>TURN LOG:</b>\n`;
    allLogs.forEach((log, i) => {
      const prefix = i === allLogs.length - 1 ? '└─' : '├─';
      msg += `${prefix} ${log}\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━`;

  const buttons = [
    [Markup.button.callback('🗡️ Serang', `raid:${pairKey}:${turnNumber}:attack`)],
    [
      Markup.button.callback('🛡️ Bertahan', `raid:${pairKey}:${turnNumber}:defend`),
      Markup.button.callback('🔮 Skill', `raid:skills:${turnNumber}`),
    ],
  ];

  const sendToPlayer = (chatId) => {
    const p = players[chatId];
    if (p && p.alive) {
      bot.telegram.sendMessage(chatId, msg + `\n\n_Pilih aksi Turn ${turnNumber}:_`, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard(buttons)
      }).catch(() => {});
    } else {
      bot.telegram.sendMessage(chatId, msg + `\n<i>Kamu sudah tumbang. Menonton...</i>`, { parse_mode: 'HTML' }).catch(() => {});
      raid.actions[chatId] = { type: 'dead' };
    }
  };

  sendToPlayer(chatIdA);
  sendToPlayer(chatIdB);
}

function checkRaidResolve(bot, pairKey) {
  const raid = raidSessions.get(pairKey);
  if (!raid) return;

  const { chatIdA, chatIdB, players, actions } = raid;
  const bothActed = actions[chatIdA] && actions[chatIdB];
  if (!bothActed) return;

  const logs = resolveTurn(raid, actions);
  raid.actions = {};
  raid.pendingLogs = logs;

  // Sync HP ke DB setiap akhir turn (agar tidak hilang jika bot restart)
  updateHp(chatIdA, players[chatIdA].hp);
  updateHp(chatIdB, players[chatIdB].hp);

  const isPartyDead = !players[chatIdA].alive && !players[chatIdB].alive;
  const isBossDead = raid.boss.hp <= 0;

  if (isBossDead) {
    // WIN — set cooldown saat raid selesai (fair: hanya kalau benar-benar selesai)
    setDungeonCooldown(chatIdA);
    setDungeonCooldown(chatIdB);

    // gunakan reward tetap per tier, bukan formula HP-based
    const settings = getGameSettings();
    const xpReward = Math.floor((raid.boss.xpReward || Math.floor(raid.boss.baseHp * 2)) * settings.exp_multiplier);
    const goldReward = Math.floor((raid.boss.goldReward || Math.floor(raid.boss.baseHp * 1.2)) * settings.gold_multiplier);
    const lootWinner = Math.random() < 0.5 ? chatIdA : chatIdB;

    const xpResultA = addXp(chatIdA, xpReward);
    const xpResultB = addXp(chatIdB, xpReward);
    addGold(chatIdA, goldReward);
    incrementQuestProgress(chatIdA, 'dungeon');
    incrementQuestProgress(chatIdB, 'dungeon');
    addGold(chatIdB, goldReward);
    addItem(lootWinner, raid.boss.legendaryDrop);

    finalizeDungeonRun(raid.runId, 'win', { item: raid.boss.legendaryDrop, winner: lootWinner.toString() });
    raidSessions.delete(pairKey);

    // Cek level-up untuk masing-masing pemain
    const levelUpA = xpResultA.leveled && xpResultA.leveled.length > 0 ? `\n🎉 <b>${players[chatIdA].className} LEVEL UP!</b> → Lv <b>${xpResultA.newLevel}</b>!` : '';
    const levelUpB = xpResultB.leveled && xpResultB.leveled.length > 0 ? `\n🎉 <b>${players[chatIdB].className} LEVEL UP!</b> → Lv <b>${xpResultB.newLevel}</b>!` : '';

    const winMsgBase =
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎉 <b>VICTORY!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `👹 <b>${raid.boss.name}</b> — <b>DEFEATED!</b>\n\n` +
      logs.join('\n') + `\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `✨ +<b>${xpReward}</b> XP | 💰 +<b>${goldReward}g</b> untuk KEDUA pemain!\n\n` +
      `🎁 <b>LEGENDARY DROP:</b>\n` +
      `🟠 <b>${raid.boss.legendaryDrop.replace(/_/g, ' ')}</b> → ${players[lootWinner].className}!` +
      `\n━━━━━━━━━━━━━━━━━━━━`;

    bot.telegram.sendMessage(chatIdA, winMsgBase + levelUpA, { parse_mode: 'HTML' }).catch(() => {});
    bot.telegram.sendMessage(chatIdB, winMsgBase + levelUpB, { parse_mode: 'HTML' }).catch(() => {});
    // HP sudah di-sync per turn — tidak perlu updateHp lagi di sini
    return;
  }

  if (isPartyDead) {
    // LOSE — set cooldown saat raid selesai
    setDungeonCooldown(chatIdA);
    setDungeonCooldown(chatIdB);

    const penaltyHpA = Math.floor(players[chatIdA].maxHp * 0.2);
    const penaltyHpB = Math.floor(players[chatIdB].maxHp * 0.2);
    updateHp(chatIdA, penaltyHpA);
    updateHp(chatIdB, penaltyHpB);
    finalizeDungeonRun(raid.runId, 'lose', null);
    raidSessions.delete(pairKey);

    const loseMsg =
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `💀 <b>DEFEATED</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      logs.join('\n') + `\n\n` +
      `Party tumbang melawan <b>${raid.boss.name}</b>.\n\n` +
      `❤️ HP dipulihkan ke 20%\n` +
      `⏳ Cooldown dungeon 10 menit, setelah itu bisa raid lagi!\n\n` +
      `💡 <i>Gunakan /heal sebelum raid untuk persiapan</i>` +
      `\n━━━━━━━━━━━━━━━━━━━━`;
    bot.telegram.sendMessage(chatIdA, loseMsg, { parse_mode: 'HTML' }).catch(() => {});
    bot.telegram.sendMessage(chatIdB, loseMsg, { parse_mode: 'HTML' }).catch(() => {});
    return;
  }

  // Continue
  sendCombatUI(bot, raid);
}

function clearRaidSession(chatId, partnerId) {
  if (!partnerId) return false;
  const key = getPairKey(chatId, partnerId);
  const raid = raidSessions.get(key);
  if (raid) {
    finalizeDungeonRun(raid.runId, 'abandoned', null);
    raidSessions.delete(key);
    // Cooldown 3 menit saat abandon (mencegah spam dungeon)
    setDungeonCooldown(raid.chatIdA);
    setDungeonCooldown(raid.chatIdB);
    // Notifikasi ke partner yang masih aktif
    const remainingId = chatId === raid.chatIdA ? raid.chatIdB : raid.chatIdA;
    botRef?.telegram.sendMessage(remainingId, '⏰ <b>Raid dibatalkan!</b>\n\nPartner meninggalkan chat sebelum raid selesai.\nCooldown dungeon aktif.', { parse_mode: 'HTML' }).catch(() => {});
    return true;
  }
  return false;
}

function setupCoop(bot, { getPartnerId, rateLimitCommand }) {
  botRef = bot; // Simpan reference untuk cleanup interval

  bot.command('dungeon', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner (/search) untuk memulai dungeon!');

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    const partner = getOrCreateUser(partnerId);
    if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG. Minta dia /profile dulu!');

    const pairKey = getPairKey(userId, partnerId);
    if (raidSessions.has(pairKey)) return ctx.reply('⚔️ Raid sudah berjalan!');
    if (dungeonInvites.has(pairKey)) return ctx.reply('⏳ Sudah ada undangan dungeon yang menunggu konfirmasi!');

    // Cek cooldown dungeon (30 menit per pemain)
    const myCooldown = getDungeonCooldown(user);
    const partnerCooldown = getDungeonCooldown(partner);
    if (myCooldown > 0) {
      const mins = Math.ceil(myCooldown / 60);
      return ctx.reply(`⏳ Kamu masih cooldown dungeon! Bisa raid lagi dalam <b>${mins} menit</b>.`, { parse_mode: 'HTML' });
    }
    if (partnerCooldown > 0) {
      const mins = Math.ceil(partnerCooldown / 60);
      return ctx.reply(`⏳ Partnermu masih cooldown dungeon! Bisa raid lagi dalam <b>${mins} menit</b>.`, { parse_mode: 'HTML' });
    }

    // Tampilkan menu pilih kategori dungeon
    const avgLv = Math.floor((user.level + partner.level) / 2);
    const bosses = getBossConfig();
    const unlockedTiers = bosses.filter(t => avgLv >= t.minAvgLv);
    const lockedTiers = bosses.filter(t => avgLv < t.minAvgLv);

    let msg = `🏰 *Pilih Dungeon* 🏰\n\n`;
    msg += `📊 Rata-rata level party: *${avgLv}*\n`;
    msg += `⏳ Status: Siap raid!\n\n`;
    msg += `*Dungeon Tersedia:*\n`;
    for (const t of unlockedTiers) {
      msg += `${t.ui_emoji} <b>${t.ui_label}</b> <i>(Min. Lv ${t.minAvgLv})</i>\n`;
      msg += `   ${t.ui_desc}\n`;
      msg += `   💰 ${t.ui_reward}\n\n`;
    }
    if (lockedTiers.length > 0) {
      msg += `*🔒 Belum Terbuka:*\n`;
      for (const t of lockedTiers) {
        msg += `🔒 ~~${t.ui_label}~~ _(Min. Lv ${t.minAvgLv})_\n`;
      }
    }
    msg += `\n_Pilih dungeon di bawah:_`;

    const buttons = unlockedTiers.map(t => [
      Markup.button.callback(`${t.ui_emoji} ${t.ui_label}`, `dungeon:pick:${t.tier}`)
    ]);
    buttons.push([Markup.button.callback('❌ Batal', 'dungeon:cancel')]);

    ctx.reply(msg, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
  });

  // Pemain memilih tier dungeon → kirim undangan ke partner
  bot.action(/^dungeon:pick:(\d+)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.answerCbQuery('Kamu tidak punya partner aktif.', { show_alert: true });

    const tierId = parseInt(ctx.match[1]);
    const bosses = getBossConfig();
    const bossTierDef = bosses.find(t => t.tier === tierId);
    if (!bossTierDef) return ctx.answerCbQuery('Tier tidak valid.', { show_alert: true });

    const user = getOrCreateUser(userId);
    const partner = getOrCreateUser(partnerId);
    if (!user || !partner) return ctx.answerCbQuery('Data karakter tidak ditemukan.', { show_alert: true });

    const avgLv = Math.floor((user.level + partner.level) / 2);
    if (avgLv < bossTierDef.minAvgLv) {
      return ctx.answerCbQuery(`❌ Belum terbuka! Butuh rata-rata Lv ${bossTierDef.minAvgLv}.`, { show_alert: true });
    }

    const pairKey = getPairKey(userId, partnerId);
    if (raidSessions.has(pairKey) || dungeonInvites.has(pairKey)) {
      return ctx.answerCbQuery('Sudah ada sesi dungeon aktif!', { show_alert: true });
    }

    dungeonInvites.set(pairKey, { inviter: userId, invitee: partnerId, tierId, createdAt: Date.now() });
    ctx.answerCbQuery(`Undangan ${bossTierDef.ui_label} dikirim!`);
    ctx.editMessageText(
      `${bossTierDef.ui_emoji} Kamu memilih <b>${bossTierDef.ui_label}</b>!\n\nMenunggu konfirmasi partner...`,
      { parse_mode: 'HTML' }
    );

    bot.telegram.sendMessage(partnerId,
      `⚔️ <b>Undangan Dungeon Raid!</b>\n\n` +
      `Partnermu mengajak masuk ke <b>${bossTierDef.ui_emoji} ${bossTierDef.ui_label}</b>!\n\n` +
      `👹 ${bossTierDef.ui_desc}\n` +
      `💰 Reward: ${bossTierDef.ui_reward}\n` +
      `📊 Rata-rata level party: ${avgLv}\n\n` +
      `_Cooldown 10 menit aktif setelah raid selesai._`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Masuk!', 'dungeon:accept'), Markup.button.callback('❌ Tolak', 'dungeon:reject')]
        ])
      }
    ).catch(() => {});
  });

  bot.action('dungeon:cancel', rateLimitCommand, (ctx) => {
    ctx.answerCbQuery('Dibatalkan.');
    ctx.editMessageText('❌ Pemilihan dungeon dibatalkan.');
  });

  bot.action(/^dungeon:(accept|reject)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.answerCbQuery('Kamu tidak punya partner aktif.', { show_alert: true });

    const pairKey = getPairKey(userId, partnerId);
    const invite = dungeonInvites.get(pairKey);
    if (!invite) return ctx.answerCbQuery('Undangan sudah tidak valid.', { show_alert: true });
    if (Date.now() - invite.createdAt > RAID_INVITE_TIMEOUT) {
      dungeonInvites.delete(pairKey);
      return ctx.answerCbQuery('Undangan dungeon sudah kedaluwarsa (10 menit).', { show_alert: true });
    }
    if (invite.inviter === userId) return ctx.answerCbQuery('Tunggu partnermu yang merespons!', { show_alert: true });

    const action = ctx.match[1];
    dungeonInvites.delete(pairKey);

    if (action === 'reject') {
      ctx.answerCbQuery('Ditolak.');
      ctx.reply('❌ Kamu menolak undangan dungeon.');
      bot.telegram.sendMessage(partnerId, '❌ Partnermu menolak undangan dungeon.').catch(() => {});
      return;
    }

    // Accept — start raid
    // Cooldown akan di-set saat raid selesai (win/lose), bukan saat mulai
    // Sehingga kalau abandon/disconnect, tidak kena cooldown
    const userA = getOrCreateUser(invite.inviter);
    const userB = getOrCreateUser(userId);

    const avgLv = Math.floor((userA.level + userB.level) / 2);
    // Gunakan tier yang dipilih inviter, bukan auto-detect dari avgLv
    const bossTier = getBossTierById(invite.tierId) || getBossTier(avgLv);
    const scaledHp = Math.floor(bossTier.baseHp * (1 + (avgLv - bossTier.minAvgLv) * 0.03));
    // ATK scaling — boss makin kuat di level tinggi
    const atkScale = 1 + (avgLv - bossTier.minAvgLv) * 0.02;
    const scaledAtkMin = Math.floor(bossTier.baseAtk[0] * atkScale);
    const scaledAtkMax = Math.floor(bossTier.baseAtk[1] * atkScale);

    const runId = createDungeonRun(invite.inviter, userId, bossTier.id);

    const clsA = CLASS_DEFS[userA.class_name];
    const clsB = CLASS_DEFS[userB.class_name];

    const equipV2A = equipmentV2.bonuses(invite.inviter);
    const equipV2B = equipmentV2.bonuses(userId);
    const raid = {
      pairKey,
      chatIdA: invite.inviter,
      chatIdB: userId,
      runId,
      turnNumber: 1,
      enrageAnnounced: false,
      lastActivity: Date.now(),
      boss: {
        id: bossTier.id,
        name: bossTier.name,
        hp: scaledHp,
        maxHp: scaledHp,
        atkRange: [scaledAtkMin, scaledAtkMax],
        def: bossTier.baseDef,
        physResist: bossTier.physResist || 0,
        magicResist: bossTier.magicResist || 0,
        legendaryDrop: bossTier.legendaryDrop,
        xpReward: bossTier.xpReward,
        goldReward: bossTier.goldReward,
      },
      players: {
        [invite.inviter]: {
          classId: userA.class_name,
          className: clsA.name,
          icon: clsA.name.split(' ')[0],
          hp: getCurrentHp(userA) + (equipV2A.max_hp || 0),
          maxHp: userA.max_hp + (equipV2A.max_hp || 0),
          atk: userA.atk + getEquipmentBonus(invite.inviter).atkBonus + (equipV2A.atk || 0),
          def: userA.def + getEquipmentBonus(invite.inviter).defBonus + (equipV2A.def || 0),
          magicAtk: (userA.magic_atk || 0) + (equipV2A.magic_atk || 0),
          atkBonus: getEquipmentBonus(invite.inviter).atkBonus,
          critRate: (userA.crit_rate || 0.05) + (equipV2A.crit_rate || 0),
          critMulti: userA.crit_multi || 1.5,
          physResist: (userA.phys_resist || 0) + (equipV2A.phys_resist || 0),
          magicResist: (userA.magic_resist || 0) + (equipV2A.magic_resist || 0),
          skillCooldown: 0,
          skillCooldowns: {},
          skillLoadout: skillService.getCombatLoadout(invite.inviter),
          alive: true,
          defending: false,
        },
        [userId]: {
          classId: userB.class_name,
          className: clsB.name,
          icon: clsB.name.split(' ')[0],
          hp: getCurrentHp(userB) + (equipV2B.max_hp || 0),
          maxHp: userB.max_hp + (equipV2B.max_hp || 0),
          atk: userB.atk + getEquipmentBonus(userId).atkBonus + (equipV2B.atk || 0),
          def: userB.def + getEquipmentBonus(userId).defBonus + (equipV2B.def || 0),
          magicAtk: (userB.magic_atk || 0) + (equipV2B.magic_atk || 0),
          atkBonus: getEquipmentBonus(userId).atkBonus,
          critRate: (userB.crit_rate || 0.05) + (equipV2B.crit_rate || 0),
          critMulti: userB.crit_multi || 1.5,
          physResist: (userB.phys_resist || 0) + (equipV2B.phys_resist || 0),
          magicResist: (userB.magic_resist || 0) + (equipV2B.magic_resist || 0),
          skillCooldown: 0,
          skillCooldowns: {},
          skillLoadout: skillService.getCombatLoadout(userId),
          alive: true,
          defending: false,
        },
      },
      actions: {},
      pendingLogs: [],
    };

    raidSessions.set(pairKey, raid);

    ctx.answerCbQuery('Raid dimulai!');
    const startMsg = `⚔️ <b>DUNGEON RAID DIMULAI!</b>\n\n👹 Boss: <b>${bossTier.name}</b>\n📊 Rata-rata level party: ${avgLv}\n\nKedua pemain memilih aksi pada setiap turn. Turn diproses setelah keduanya siap.\n⏰ Sesi batal jika 5 menit tanpa aktivitas.\nCooldown 10 menit aktif setelah raid selesai (win/lose).\n\nPersiapkan diri!`;
    bot.telegram.sendMessage(invite.inviter, startMsg, { parse_mode: 'HTML' }).catch(() => {});
    bot.telegram.sendMessage(userId, startMsg, { parse_mode: 'HTML' }).catch(() => {});

    setTimeout(() => sendCombatUI(bot, raid), 1500);
  });

  // Combat action handler
  bot.action(/^raid:(.+):(\d+):(attack|defend|item)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const [, pairKey, turnStr, actionType] = ctx.match;
    const turnNumber = parseInt(turnStr);

    const raid = raidSessions.get(pairKey);
    if (!raid) return ctx.answerCbQuery('Raid sudah selesai.', { show_alert: true });

    // Timeout check: auto-abandon jika inactive > 5 menit
    if (Date.now() - raid.lastActivity > RAID_SESSION_TIMEOUT) {
      finalizeDungeonRun(raid.runId, 'abandoned', null);
      raidSessions.delete(pairKey);
      bot.telegram.sendMessage(raid.chatIdA, '⏰ Raid dibatalkan karena tidak ada aktivitas selama 5 menit.').catch(() => {});
      bot.telegram.sendMessage(raid.chatIdB, '⏰ Raid dibatalkan karena tidak ada aktivitas selama 5 menit.').catch(() => {});
      return ctx.answerCbQuery('Raid timeout!', { show_alert: true });
    }

    if (raid.turnNumber !== turnNumber) return ctx.answerCbQuery('Turn ini sudah berlalu.', { show_alert: true });
    if (raid.actions[userId]) return ctx.answerCbQuery('Kamu sudah memilih!', { show_alert: true });

    const player = raid.players[userId];
    if (!player || !player.alive) return ctx.answerCbQuery('Kamu sudah tumbang!', { show_alert: true });
    raid.actions[userId] = { type: actionType };
    raid.lastActivity = Date.now(); // Update activity timestamp
    ctx.answerCbQuery('Aksi dikonfirmasi!');

    // Hanya kirim "Menunggu partner..." jika partner belum pilih aksi
    const partnerChatId = userId === raid.chatIdA ? raid.chatIdB : raid.chatIdA;
    if (!raid.actions[partnerChatId]) {
      ctx.reply('⏳ Menunggu partner...');
    }

    checkRaidResolve(bot, pairKey);
  });

  function findRaidForUser(userId) {
    const id = String(userId);
    for (const raid of raidSessions.values()) {
      if (String(raid.chatIdA) === id || String(raid.chatIdB) === id) return raid;
    }
    return null;
  }

  function submitSkillAction(ctx, raid, action) {
    const userId = ctx.chat.id;
    raid.actions[userId] = action;
    raid.lastActivity = Date.now();
    ctx.answerCbQuery('Aksi dikonfirmasi!');
    const partnerId = userId === raid.chatIdA ? raid.chatIdB : raid.chatIdA;
    if (!raid.actions[partnerId]) ctx.reply('⏳ Menunggu partner...');
    checkRaidResolve(bot, raid.pairKey);
  }

  bot.action(/^raid:skills:(\d+)$/, rateLimitCommand, ctx => {
    const raid = findRaidForUser(ctx.chat.id);
    const turnNumber = Number(ctx.match[1]);
    if (!raid) return ctx.answerCbQuery('Raid sudah selesai.', { show_alert: true });
    if (raid.turnNumber !== turnNumber) return ctx.answerCbQuery('Turn ini sudah berlalu.', { show_alert: true });
    if (raid.actions[ctx.chat.id]) return ctx.answerCbQuery('Kamu sudah memilih!', { show_alert: true });
    const player = raid.players[ctx.chat.id];
    if (!player || !player.alive) return ctx.answerCbQuery('Kamu sudah tumbang!', { show_alert: true });
    if (!player.skillLoadout?.length) {
      if (player.skillCooldown > 0) {
        return ctx.answerCbQuery(`Skill cooldown ${player.skillCooldown} turn!`, { show_alert: true });
      }
      return submitSkillAction(ctx, raid, { type: 'skill' });
    }
    const buttons = player.skillLoadout.map(skill => {
      const cooldown = getSkillCooldown(player, skill.id);
      const suffix = cooldown > 0 ? ` (${cooldown}T)` : '';
      return [Markup.button.callback(
        `${skill.name}${suffix}`,
        `raid:skill:${turnNumber}:${skill.id}`,
      )];
    });
    ctx.answerCbQuery();
    return ctx.reply('Pilih skill dari loadout:', Markup.inlineKeyboard(buttons));
  });

  bot.action(/^raid:skill:(\d+):([a-z0-9_]+)$/, rateLimitCommand, ctx => {
    const raid = findRaidForUser(ctx.chat.id);
    const turnNumber = Number(ctx.match[1]);
    const skillId = ctx.match[2];
    if (!raid) return ctx.answerCbQuery('Raid sudah selesai.', { show_alert: true });
    if (raid.turnNumber !== turnNumber) return ctx.answerCbQuery('Turn ini sudah berlalu.', { show_alert: true });
    if (raid.actions[ctx.chat.id]) return ctx.answerCbQuery('Kamu sudah memilih!', { show_alert: true });
    const player = raid.players[ctx.chat.id];
    const skill = player && findLoadoutSkill(player, skillId);
    if (!skill) return ctx.answerCbQuery('Skill bukan bagian loadout-mu.', { show_alert: true });
    const cooldown = getSkillCooldown(player, skillId);
    if (cooldown > 0) return ctx.answerCbQuery(`Cooldown ${cooldown} turn!`, { show_alert: true });
    return submitSkillAction(ctx, raid, { type: 'skill', skillId });
  });

  return { clearRaidSession };
}


// ===== PERIODIC CLEANUP =====
// Auto-abandon raid yang idle > 5 menit (sama dengan validasi callback).

setInterval(() => {
  const now = Date.now();
  for (const [pairKey, raid] of raidSessions) {
    if (now - raid.lastActivity > RAID_SESSION_TIMEOUT) {
      // Auto-abandon
      finalizeDungeonRun(raid.runId, 'abandoned', null);
      setDungeonCooldown(raid.chatIdA);
      setDungeonCooldown(raid.chatIdB);

      const timeoutMsg = '⏰ <b>Raid Timeout!</b>\n' +
        '\nSesi raid dibatalkan karena tidak ada aktivitas selama 5 menit.\n' +
        'Cooldown dungeon aktif.';
      botRef.telegram.sendMessage(raid.chatIdA, timeoutMsg, { parse_mode: 'HTML' }).catch(() => {});
      botRef.telegram.sendMessage(raid.chatIdB, timeoutMsg, { parse_mode: 'HTML' }).catch(() => {});

      raidSessions.delete(pairKey);
    }
  }
  for (const [pairKey, invite] of dungeonInvites) {
    if (now - invite.createdAt > RAID_INVITE_TIMEOUT) dungeonInvites.delete(pairKey);
  }
}, 60 * 1000); // Check setiap 1 menit

module.exports = {
  setupCoop,
  clearRaidSession,
  resolveTurn,
  RAID_SESSION_TIMEOUT,
  RAID_INVITE_TIMEOUT,
};
