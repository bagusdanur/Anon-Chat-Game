// src/rpg/duel.js
// PvP Duel — Turn-based 1v1 dengan partner
const { Markup } = require('telegraf');
const {
  getOrCreateUser, getCurrentHp, getCurrentEnergy,
  addXp, addGold, updateHp, CLASS_DEFS, getEquipmentBonus,
  calcPhysicalDamage, calcMagicDamage, rollCrit,
  getDuelCooldown, setDuelCooldown, createDuelRun, finalizeDuelRun,
  incrementWinStreak, resetWinStreak, getWinStreak,
  clearStatusEffects
} = require('./db_rpg');

const duelSessions = new Map();

function getDuelPairKey(a, b) {
  return [a.toString(), b.toString()].sort().join(':');
}

function resolveDuelTurn(duel, actions) {
  const logs = [];
  const { playerA, playerB } = duel;

  // Process actions
  for (const [uid, action] of Object.entries(actions)) {
    if (action.type === 'dead') continue;
    const attacker = uid === duel.chatIdA ? playerA : playerB;
    const defender = uid === duel.chatIdA ? playerB : playerA;

    if (action.type === 'attack') {
      const cls = CLASS_DEFS[attacker.classId];
      const baseDmg = cls.damageType === 'magic'
        ? (attacker.magicAtk || attacker.atk)
        : attacker.atk + (attacker.atkBonus || 0);
      const defenderStats = { def: defender.def, phys_resist: defender.physResist || 0, magic_resist: defender.magicResist || 0 };
      let dmg;
      if (cls.damageType === 'magic') {
        dmg = calcMagicDamage(attacker, defenderStats, baseDmg);
      } else {
        dmg = calcPhysicalDamage(attacker, defenderStats, baseDmg);
      }
      const { isCrit, multiplier } = rollCrit(attacker.critRate || 0.05, attacker.critMulti || 1.5);
      dmg = Math.floor(dmg * multiplier);
      defender.hp = Math.max(0, defender.hp - dmg);
      const critText = isCrit ? ' 💥 CRIT!' : '';
      logs.push(`${attacker.icon} ${attacker.className} menyerang! *-${dmg} HP*${critText}`);

    } else if (action.type === 'skill') {
      const cls = CLASS_DEFS[attacker.classId];
      if (attacker.skillCooldown > 0) {
        logs.push(`${attacker.icon} Skill masih cooldown ${attacker.skillCooldown} turn!`);
        continue;
      }
      const baseDmg = cls.damageType === 'magic' ? (attacker.magicAtk || attacker.atk) : (attacker.atk + (attacker.atkBonus || 0));
      const defenderStats = { def: defender.def, phys_resist: defender.physResist || 0, magic_resist: defender.magicResist || 0 };
      const skillMulti = cls.skillMulti || 2.0;
      let dmg;
      if (cls.damageType === 'magic') {
        dmg = calcMagicDamage(attacker, defenderStats, baseDmg, skillMulti);
      } else if (attacker.classId === 'pencuri') {
        dmg = calcPhysicalDamage(attacker, defenderStats, baseDmg, skillMulti);
        dmg = Math.floor(dmg * (attacker.critMulti || 1.8)); // 100% crit
      } else {
        dmg = calcPhysicalDamage(attacker, defenderStats, baseDmg, skillMulti, 0.10);
      }
      defender.hp = Math.max(0, defender.hp - dmg);
      attacker.skillCooldown = attacker.classId === 'pencuri' ? 4 : 3;
      logs.push(`${attacker.icon} ${attacker.className}: ${cls.skillName}! *-${dmg} HP* 💥 Skill!`);

    } else if (action.type === 'defend') {
      attacker.defending = true;
      logs.push(`${attacker.icon} ${attacker.className}: Bertahan! -50% damage`);
    }

    // Cooldown tick
    if (attacker.skillCooldown > 0 && action.type !== 'skill') attacker.skillCooldown--;
  }

  // Boss-style: attacker defends reduces damage
  // Process defender damage (both players take damage from opponent's attack)
  // Actually in PvP, only the attacker deals damage to defender (already done above)

  // If both players attacked, check if someone died
  if (playerA.hp <= 0 || playerB.hp <= 0) return logs;

  // Both alive — continue
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

  const buttons = [
    [Markup.button.callback('🗡️ Serang', `duel:${pairKey}:${turnNumber}:attack`)],
    [
      Markup.button.callback('🛡️ Bertahan', `duel:${pairKey}:${turnNumber}:defend`),
      Markup.button.callback('🔮 Skill', `duel:${pairKey}:${turnNumber}:skill`),
    ],
  ];

  const sendTo = (chatId, player) => {
    const p = player;
    const buttons2 = p.alive ? [
      [Markup.button.callback('🗡️ Serang', `duel:${pairKey}:${turnNumber}:attack`)],
      [Markup.button.callback('🛡️ Bertahan', `duel:${pairKey}:${turnNumber}:defend`),
       Markup.button.callback('🔮 Skill', `duel:${pairKey}:${turnNumber}:skill`)],
    ] : [];
    bot.telegram.sendMessage(chatId, msg + (p.alive ? `_Pilih aksi Turn ${turnNumber}:_` : `_Kamu sudah kalah!_`), {
      parse_mode: 'Markdown',
      ...(p.alive ? Markup.inlineKeyboard(buttons2) : {})
    }).catch(() => {});
  };

  sendTo(chatIdA, playerA);
  sendTo(chatIdB, playerB);
}

function setupDuel(bot, { getPartnerId, rateLimitCommand }) {
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

    // Cooldown check
    const myCd = getDuelCooldown(userId);
    const partnerCd = getDuelCooldown(partnerId);
    if (myCd > 0) return ctx.reply(`⏳ Cooldown duel: ${Math.ceil(myCd / 60)} menit`);
    if (partnerCd > 0) return ctx.reply(`⏳ Partner masih cooldown duel: ${Math.ceil(partnerCd / 60)} menit`);

    // Set cooldown langsung
    setDuelCooldown(userId);
    setDuelCooldown(partnerId);

    const clsA = CLASS_DEFS[user.class_name];
    const clsB = CLASS_DEFS[partner.class_name];
    const equipA = getEquipmentBonus(userId);
    const equipB = getEquipmentBonus(partnerId);

    const hpA = Math.floor(getCurrentHp(user) * 0.5); // 50% HP untuk duel cepat
    const hpB = Math.floor(getCurrentHp(partner) * 0.5);

    const runId = createDuelRun(userId, partnerId);

    const duel = {
      pairKey,
      chatIdA: userId,
      chatIdB: partnerId,
      runId,
      turnNumber: 1,
      lastActivity: Date.now(),
      playerA: {
        classId: user.class_name,
        className: clsA.name,
        icon: clsA.name.split(' ')[0],
        hp: hpA,
        maxHp: user.max_hp,
        atk: user.atk + equipA.atkBonus,
        def: user.def + equipA.defBonus,
        magicAtk: user.magic_atk || 0,
        atkBonus: equipA.atkBonus,
        critRate: user.crit_rate || 0.05,
        critMulti: user.crit_multi || 1.5,
        physResist: user.phys_resist || 0,
        magicResist: user.magic_resist || 0,
        skillCooldown: 0,
        alive: true,
        defending: false,
      },
      playerB: {
        classId: partner.class_name,
        className: clsB.name,
        icon: clsB.name.split(' ')[0],
        hp: hpB,
        maxHp: partner.max_hp,
        atk: partner.atk + equipB.atkBonus,
        def: partner.def + equipB.defBonus,
        magicAtk: partner.magic_atk || 0,
        atkBonus: equipB.atkBonus,
        critRate: partner.crit_rate || 0.05,
        critMulti: partner.crit_multi || 1.5,
        physResist: partner.phys_resist || 0,
        magicResist: partner.magic_resist || 0,
        skillCooldown: 0,
        alive: true,
        defending: false,
      },
      actions: {},
      pendingLogs: [],
    };

    duelSessions.set(pairKey, duel);

    const startMsg = `⚔️ **DUEL DIMULAI!**\n\n${clsA.name} vs ${clsB.name}\nHP: 50% max (duel cepat)\n\nCooldown 5 menit aktif setelah selesai.`;
    bot.telegram.sendMessage(userId, startMsg, { parse_mode: 'Markdown' }).catch(() => {});
    bot.telegram.sendMessage(partnerId, startMsg, { parse_mode: 'Markdown' }).catch(() => {});

    setTimeout(() => sendDuelUI(bot, duel), 1500);
  });

  // Combat action handler
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

    // Check both acted
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
      // Duel selesai
      let winnerId, loserId, winnerPlayer, loserPlayer;
      if (isADead && isBDead) {
        // Draw
        const xpReward = 20, goldReward = 10;
        addXp(duel.chatIdA, xpReward);
        addXp(duel.chatIdB, xpReward);
        addGold(duel.chatIdA, goldReward);
        addGold(duel.chatIdB, goldReward);
        finalizeDuelRun(duel.runId, null, xpReward, goldReward);

        const drawMsg = logs.join('\n') + `\n\n🤝 **DRAW!**\n✨ +${xpReward} XP · 💰 +${goldReward}g untuk kedua pemain`;
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
        // Calculate rewards
        const streak = getWinStreak(winnerId);
        const bonus = streak >= 2 ? 1.2 : 1.0; // +20% jika streak 3x
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
          `🥈 +${xpLose} XP · 💰 +${goldLose}g (untuk yang kalah)`;

        bot.telegram.sendMessage(winnerId, winMsg, { parse_mode: 'Markdown' }).catch(() => {});
        bot.telegram.sendMessage(loserId, winMsg, { parse_mode: 'Markdown' }).catch(() => {});
      }

      duelSessions.delete(pairKey);
      return;
    }

    // Continue
    sendDuelUI(bot, duel);
  });
}

module.exports = { setupDuel };
