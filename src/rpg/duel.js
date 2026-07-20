// src/rpg/duel.js
// PvP Duel — Turn-based 1v1 dengan partner (invite/accept system)
const { Markup } = require('telegraf');
const {
  getOrCreateUser, getCurrentHp,
  addXp, addGold, updateHp, CLASS_DEFS, getEquipmentBonus,
  calcPhysicalDamage, calcMagicDamage, rollCrit,
  getDuelCooldown, setDuelCooldown, createDuelRun, finalizeDuelRun,
  incrementWinStreak, resetWinStreak, getWinStreak,
} = require('./db_rpg');

const duelSessions = new Map();
const duelInvites = new Map(); // pairKey → { inviter, invitee }

function getDuelPairKey(a, b) {
  return [a.toString(), b.toString()].sort().join(':');
}

function resolveDuelTurn(duel, actions) {
  const logs = [];
  const { playerA, playerB } = duel;

  for (const [uid, action] of Object.entries(actions)) {
    if (action.type === 'dead') continue;
    const attacker = uid === duel.chatIdA ? playerA : playerB;
    const defender = uid === duel.chatIdA ? playerB : playerA;

    if (action.type === 'attack') {
      const cls = CLASS_DEFS[attacker.classId];
      const baseDmg = cls.damageType === 'magic'
        ? (attacker.magicAtk || attacker.atk)
        : attacker.atk + (attacker.atkBonus || 0);
      const defStats = { def: defender.def, phys_resist: defender.physResist || 0, magic_resist: defender.magicResist || 0 };
      let dmg;
      if (cls.damageType === 'magic') {
        dmg = calcMagicDamage(attacker, defStats, baseDmg);
      } else {
        dmg = calcPhysicalDamage(attacker, defStats, baseDmg);
      }
      const { isCrit, multiplier } = rollCrit(attacker.critRate || 0.05, attacker.critMulti || 1.5);
      dmg = Math.floor(dmg * multiplier);
      defender.hp = Math.max(0, defender.hp - dmg);
      logs.push(`${attacker.icon} ${attacker.className} menyerang! *-${dmg} HP*${isCrit ? ' 💥 CRIT!' : ''}`);

    } else if (action.type === 'skill') {
      const cls = CLASS_DEFS[attacker.classId];
      if (attacker.skillCooldown > 0) {
        logs.push(`${attacker.icon} Skill cooldown ${attacker.skillCooldown} turn!`);
        continue;
      }
      const baseDmg = cls.damageType === 'magic' ? (attacker.magicAtk || attacker.atk) : (attacker.atk + (attacker.atkBonus || 0));
      const defStats = { def: defender.def, phys_resist: defender.physResist || 0, magic_resist: defender.magicResist || 0 };
      const skillMulti = cls.skillMulti || 2.0;
      let dmg;
      if (cls.damageType === 'magic') {
        dmg = calcMagicDamage(attacker, defStats, baseDmg, skillMulti);
      } else if (attacker.classId === 'pencuri') {
        dmg = calcPhysicalDamage(attacker, defStats, baseDmg, skillMulti);
        dmg = Math.floor(dmg * (attacker.critMulti || 1.8));
      } else {
        dmg = calcPhysicalDamage(attacker, defStats, baseDmg, skillMulti, 0.10);
      }
      defender.hp = Math.max(0, defender.hp - dmg);
      attacker.skillCooldown = attacker.classId === 'pencuri' ? 4 : 3;
      logs.push(`${attacker.icon} ${attacker.className}: ${cls.skillName}! *-${dmg} HP* 💥 Skill!`);

    } else if (action.type === 'defend') {
      attacker.defending = true;
      logs.push(`${attacker.icon} ${attacker.className}: Bertahan! -50% damage`);
    }

    if (attacker.skillCooldown > 0 && action.type !== 'skill') attacker.skillCooldown--;
  }

  // Defend reduction
  for (const [uid, action] of Object.entries(actions)) {
    if (action.type === 'defend') {
      const defender = uid === duel.chatIdA ? playerA : playerB;
      defender.hp = Math.min(defender.maxHp, defender.hp + Math.floor(defender.maxHp * 0.05)); // +5% HP saat defend
    }
  }

  return logs;
}

function sendDuelUI(bot, duel, extraLogs = []) {
  const { chatIdA, chatIdB, pairKey, playerA, playerB, turnNumber } = duel;
  const allLogs = [...extraLogs, ...duel.pendingLogs].join('\n');
  duel.pendingLogs = [];

  const renderBar = (cur, max, len = 6) => {
    const f = Math.min(len, Math.round((Math.max(0, cur) / max) * len));
    return '█'.repeat(f) + '░'.repeat(len - f) + ` ${Math.max(0, cur)}/${max}`;
  };

  let msg = `⚔️ **DUEL PVP** ⚔️\n\n`;
  msg += `${playerA.icon} ${playerA.className}: ${renderBar(playerA.hp, playerA.maxHp)}\n`;
  msg += `VS\n`;
  msg += `${playerB.icon} ${playerB.className}: ${renderBar(playerB.hp, playerB.maxHp)}\n\n`;
  if (allLogs) msg += `📝 ${allLogs}\n\n`;

  const sendTo = (chatId, player) => {
    if (!player.alive) {
      bot.telegram.sendMessage(chatId, msg + `_Kamu sudah kalah!_`, { parse_mode: 'Markdown' }).catch(() => {});
      return;
    }
    bot.telegram.sendMessage(chatId, msg + `_Pilih aksi Turn ${turnNumber}:_`, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🗡️ Serang', `duel:${pairKey}:${turnNumber}:attack`)],
        [Markup.button.callback('🛡️ Bertahan', `duel:${pairKey}:${turnNumber}:defend`),
         Markup.button.callback('🔮 Skill', `duel:${pairKey}:${turnNumber}:skill`)],
      ])
    }).catch(() => {});
  };

  sendTo(chatIdA, playerA);
  sendTo(chatIdB, playerB);
}

function startDuel(bot, inviterId, inviteeId) {
  const user = getOrCreateUser(inviterId);
  const partner = getOrCreateUser(inviteeId);
  if (!user || !partner) return;

  const pairKey = getDuelPairKey(inviterId, inviteeId);
  if (duelSessions.has(pairKey)) return;

  setDuelCooldown(inviterId);
  setDuelCooldown(inviteeId);

  const clsA = CLASS_DEFS[user.class_name];
  const clsB = CLASS_DEFS[partner.class_name];
  const equipA = getEquipmentBonus(inviterId);
  const equipB = getEquipmentBonus(inviteeId);

  const hpA = Math.max(1, Math.floor(getCurrentHp(user) * 0.5));
  const hpB = Math.max(1, Math.floor(getCurrentHp(partner) * 0.5));

  const runId = createDuelRun(inviterId, inviteeId);

  const duel = {
    pairKey,
    chatIdA: inviterId,
    chatIdB: inviteeId,
    runId,
    turnNumber: 1,
    lastActivity: Date.now(),
    playerA: {
      classId: user.class_name, className: clsA.name, icon: clsA.name.split(' ')[0],
      hp: hpA, maxHp: user.max_hp,
      atk: user.atk + equipA.atkBonus, def: user.def + equipA.defBonus,
      magicAtk: user.magic_atk || 0, atkBonus: equipA.atkBonus,
      critRate: user.crit_rate || 0.05, critMulti: user.crit_multi || 1.5,
      physResist: user.phys_resist || 0, magicResist: user.magic_resist || 0,
      skillCooldown: 0, alive: true, defending: false,
    },
    playerB: {
      classId: partner.class_name, className: clsB.name, icon: clsB.name.split(' ')[0],
      hp: hpB, maxHp: partner.max_hp,
      atk: partner.atk + equipB.atkBonus, def: partner.def + equipB.defBonus,
      magicAtk: partner.magic_atk || 0, atkBonus: equipB.atkBonus,
      critRate: partner.crit_rate || 0.05, critMulti: partner.crit_multi || 1.5,
      physResist: partner.phys_resist || 0, magicResist: partner.magic_resist || 0,
      skillCooldown: 0, alive: true, defending: false,
    },
    actions: {},
    pendingLogs: [],
  };

  duelSessions.set(pairKey, duel);

  const startMsg = `⚔️ **DUEL DIMULAI!**\n\n${clsA.name} vs ${clsB.name}\nHP: 50% max (duel cepat)\nCooldown 5 menit aktif setelah selesai.`;
  bot.telegram.sendMessage(inviterId, startMsg, { parse_mode: 'Markdown' }).catch(() => {});
  bot.telegram.sendMessage(inviteeId, startMsg, { parse_mode: 'Markdown' }).catch(() => {});

  setTimeout(() => sendDuelUI(bot, duel), 1500);
}

function setupDuel(bot, { getPartnerId, rateLimitCommand }) {
  // ===== /duel — Kirim undangan ke partner =====
  bot.command('duel', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner (/search) untuk duel!');

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    const partner = getOrCreateUser(partnerId);
    if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG. Minta dia /profile dulu!');

    const pairKey = getDuelPairKey(userId, partnerId);
    if (duelSessions.has(pairKey)) return ctx.reply('⚔️ Duel sudah berjalan!');
    if (duelInvites.has(pairKey)) return ctx.reply('⏳ Sudah ada undangan duel yang menunggu!');

    // Cooldown check
    const myCd = getDuelCooldown(userId);
    const partnerCd = getDuelCooldown(partnerId);
    if (myCd > 0) return ctx.reply(`⏳ Cooldown duel: ${Math.ceil(myCd / 60)} menit`);
    if (partnerCd > 0) return ctx.reply(`⏳ Partner masih cooldown duel: ${Math.ceil(partnerCd / 60)} menit`);

    // Simpan invite
    duelInvites.set(pairKey, { inviter: userId, invitee: partnerId });

    const clsA = CLASS_DEFS[user.class_name];
    const clsB = CLASS_DEFS[partner.class_name];

    ctx.reply(`⚔️ Kamu mengundang **${partner.name || partnerId}** untuk duel!`, { parse_mode: 'Markdown' });

    bot.telegram.sendMessage(partnerId,
      `⚔️ **Undangan Duel PVP!**\n\n` +
      `${clsA.name} (Lv.${user.level}) mengajak kamu duel!\n\n` +
      `📊 Stats kamu: ${clsB.name} Lv.${partner.level}\n` +
      `⏳ Cooldown: 5 menit setelah selesai`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('⚔️ Terima!', 'duel:accept'), Markup.button.callback('❌ Tolak', 'duel:reject')]
        ])
      }
    ).catch(() => {});
  });

  // ===== Accept / Reject =====
  bot.action(/^duel:(accept|reject)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.answerCbQuery('Kamu tidak punya partner aktif.', { show_alert: true });

    const pairKey = getDuelPairKey(userId, partnerId);
    const invite = duelInvites.get(pairKey);
    if (!invite) return ctx.answerCbQuery('Undangan sudah tidak valid.', { show_alert: true });
    if (invite.inviter === userId) return ctx.answerCbQuery('Tunggu partnermu yang merespons!', { show_alert: true });

    const action = ctx.match[1];
    duelInvites.delete(pairKey);

    if (action === 'reject') {
      ctx.answerCbQuery('Ditolak.');
      ctx.reply('❌ Kamu menolak undangan duel.');
      bot.telegram.sendMessage(partnerId, '❌ Partnermu menolak undangan duel.').catch(() => {});
      return;
    }

    // Accept — mulai duel
    ctx.answerCbQuery('Duel dimulai!');
    startDuel(bot, invite.inviter, userId);
  });

  // ===== Combat action handler =====
  bot.action(/^duel:(.+):(\d+):(attack|defend|skill)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const [, pairKey, turnStr, actionType] = ctx.match;
    const turnNumber = parseInt(turnStr);

    const duel = duelSessions.get(pairKey);
    if (!duel) return ctx.answerCbQuery('Duel sudah selesai.', { show_alert: true });

    if (duel.turnNumber !== turnNumber) return ctx.answerCbQuery('Turn ini sudah berlalu.', { show_alert: true });
    if (duel.actions[userId]) return ctx.answerCbQuery('Kamu sudah memilih!', { show_alert: true });

    const player = userId === duel.chatIdA ? duel.playerA : duel.playerB;
    if (!player || !player.alive) return ctx.answerCbQuery('Kamu sudah kalah!', { show_alert: true });
    if (actionType === 'skill' && player.skillCooldown > 0) {
      return ctx.answerCbQuery(`Skill cooldown ${player.skillCooldown} turn!`, { show_alert: true });
    }

    duel.actions[userId] = { type: actionType };
    duel.lastActivity = Date.now();
    ctx.answerCbQuery('Aksi dikonfirmasi!');

    const bothActed = duel.actions[duel.chatIdA] && duel.actions[duel.chatIdB];
    if (!bothActed) return;

    // Resolve turn
    const logs = resolveDuelTurn(duel, duel.actions);
    duel.actions = {};
    duel.pendingLogs = logs;

    // Sync HP
    updateHp(duel.chatIdA, duel.playerA.hp);
    updateHp(duel.chatIdB, duel.playerB.hp);

    const isADead = duel.playerA.hp <= 0;
    const isBDead = duel.playerB.hp <= 0;

    if (isADead || isBDead) {
      let winnerId, loserId, winnerPlayer, loserPlayer;

      if (isADead && isBDead) {
        // Draw
        const xpReward = 20, goldReward = 10;
        addXp(duel.chatIdA, xpReward);
        addXp(duel.chatIdB, xpReward);
        addGold(duel.chatIdA, goldReward);
        addGold(duel.chatIdB, goldReward);
        finalizeDuelRun(duel.runId, null, xpReward, goldReward);

        const drawMsg = logs.join('\n') + `\n\n🤝 **DRAW!**\n✨ +${xpReward} XP · 💰 +${goldReward}g`;
        bot.telegram.sendMessage(duel.chatIdA, drawMsg, { parse_mode: 'Markdown' }).catch(() => {});
        bot.telegram.sendMessage(duel.chatIdB, drawMsg, { parse_mode: 'Markdown' }).catch(() => {});
      } else if (isADead) {
        winnerId = duel.chatIdB; loserId = duel.chatIdA;
        winnerPlayer = duel.playerB; loserPlayer = duel.playerA;
      } else {
        winnerId = duel.chatIdA; loserId = duel.chatIdB;
        winnerPlayer = duel.playerA; loserPlayer = duel.playerB;
      }

      if (!isADead || !isBDead) {
        const streak = getWinStreak(winnerId);
        const bonus = streak >= 2 ? 1.2 : 1.0;
        const xpWin = Math.floor(50 * bonus);
        const goldWin = Math.floor(25 * bonus);
        const xpLose = 20, goldLose = 10;

        addXp(winnerId, xpWin);
        addXp(loserId, xpLose);
        addGold(winnerId, goldWin);
        addGold(loserId, goldLose);
        incrementWinStreak(winnerId);
        resetWinStreak(loserId);
        finalizeDuelRun(duel.runId, winnerId, xpWin, goldWin);

        const winMsg = logs.join('\n') + `\n\n🏆 **${winnerPlayer.className} MENANG!**\n` +
          `🥇 +${xpWin} XP · 💰 +${goldWin}g${streak >= 2 ? ' (streak bonus!)' : ''}\n` +
          `🥈 +${xpLose} XP · 💰 +${goldLose}g`;

        bot.telegram.sendMessage(winnerId, winMsg, { parse_mode: 'Markdown' }).catch(() => {});
        bot.telegram.sendMessage(loserId, winMsg, { parse_mode: 'Markdown' }).catch(() => {});
      }

      duelSessions.delete(pairKey);
      return;
    }

    sendDuelUI(bot, duel);
  });
}

module.exports = { setupDuel };
