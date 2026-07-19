const { classes } = require('./classes');

function renderHpBar(hp, maxHp, length = 10) {
  const filled = Math.round((hp / maxHp) * length);
  return '🟩'.repeat(Math.max(0, filled)) + '⬛'.repeat(Math.max(0, length - filled)) + ` ${hp}/${maxHp}`;
}

function damageRoll(atkMin, atkMax) {
  return Math.floor(Math.random() * (atkMax - atkMin + 1)) + atkMin;
}

function resolveTurn(session, actions) {
  const combat = session.combat;
  let log = [];

  // Initialize buffs for defend
  for (const chatId in session.players) {
    session.players[chatId].buffs.defending = (actions[chatId] && actions[chatId].type === 'defend');
  }

  // Sort players by SPD descending for action priority
  const playerIds = Object.keys(session.players).sort((a, b) => session.players[b].spd - session.players[a].spd);

  for (const chatId of playerIds) {
    const player = session.players[chatId];
    if (!player.alive) continue;

    const action = actions[chatId];
    if (!action) continue;

    const className = classes[player.class].name;

    if (action.type === 'attack') {
      const atkBonus = player.buffs.atkBonus || 0;
      const atkBase = damageRoll(player.atkMin, player.atkMax) + atkBonus;
      let dmg = Math.max(1, atkBase - combat.enemyDef);
      
      const isCrit = Math.random() < 0.10;
      if (isCrit) dmg = Math.floor(dmg * 1.5);

      combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
      log.push(`⚔️ **${className}** menyerang! (-${dmg} HP musuh)${isCrit ? ' 💥CRITICAL!' : ''}`);
    } else if (action.type === 'skill') {
      player.skillCooldown = classes[player.class].skillCooldownMax;
      const atkBonus = player.buffs.atkBonus || 0;
      
      if (player.class === 'ksatria') {
        const dmg1 = Math.max(1, damageRoll(player.atkMin, player.atkMax) + atkBonus - combat.enemyDef);
        const dmg2 = Math.max(1, damageRoll(player.atkMin, player.atkMax) + atkBonus - combat.enemyDef);
        const total = dmg1 + dmg2;
        combat.enemyHp = Math.max(0, combat.enemyHp - total);
        log.push(`⚡ **Tebasan Kilat!** Ksatria menebas 2x. (-${total} HP musuh)`);
      } else if (player.class === 'penyihir') {
        const dmg = 14 + atkBonus; 
        combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
        log.push(`🔥 **Bola Api!** Penyihir membakar musuh. (-${dmg} HP musuh)`);
      } else if (player.class === 'pencuri') {
        const base = damageRoll(player.atkMin, player.atkMax) + atkBonus;
        const dmg = Math.max(1, (base * 2) - combat.enemyDef);
        combat.enemyHp = Math.max(0, combat.enemyHp - dmg);
        log.push(`🗡️ **Serangan Bayangan!** Pencuri menusuk titik vital. (-${dmg} HP musuh) 💥CRIT!`);
      }
    } else if (action.type === 'defend') {
      log.push(`🛡️ **${className}** bertahan. Damage diterima turn ini berkurang 50%.`);
    } else if (action.type === 'item') {
      if (session.inventory && session.inventory.length > 0) {
        const item = session.inventory.shift(); 
        log.push(`🎒 **${className}** menggunakan item!`);
        if (item.itemType === 'potion_small') {
          player.hp = Math.min(player.maxHp, player.hp + 10);
          log.push(`🧪 HP memulih 10 poin!`);
        } else if (item.itemType === 'scroll_power') {
          player.buffs.atkBonus = (player.buffs.atkBonus || 0) + 3;
          log.push(`📜 Kekuatan serangan meningkat +3!`);
        }
      } else {
        log.push(`🎒 **${className}** mencoba memakai item, tapi tas kosong!`);
      }
    }

    if (combat.enemyHp <= 0) break; // Enemy dead
  }

  // Boss Enrage (50% HP threshold)
  if (combat.enemyHp > 0 && combat.enemyId === 'raja_terkutuk' && combat.enemyHp <= combat.enemyMaxHp * 0.5 && !combat.enraged) {
    combat.enraged = true;
    combat.enemyAtkMin = 9;
    combat.enemyAtkMax = 14;
    log.push(`🔥 **Raja Terkutuk** mengamuk! Serangannya kini jauh lebih mematikan!`);
  }

  // Enemy Turn
  if (combat.enemyHp > 0) {
    let enemyAtk = damageRoll(combat.enemyAtkMin, combat.enemyAtkMax);
    
    // Telegraph multiplier
    if (combat.telegraphActive) {
      const mult = combat.enemyId === 'raja_terkutuk' ? 2.5 : 2;
      enemyAtk = Math.floor(enemyAtk * mult);
      combat.telegraphActive = false; 
    }

    const alivePlayers = playerIds.filter(id => session.players[id].alive);
    if (alivePlayers.length > 0) {
      const targetId = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
      const targetPlayer = session.players[targetId];

      let dmgToPlayer = Math.max(1, enemyAtk - targetPlayer.def);
      if (targetPlayer.buffs.defending) {
        dmgToPlayer = Math.floor(dmgToPlayer * 0.5);
      }

      targetPlayer.hp = Math.max(0, targetPlayer.hp - dmgToPlayer);
      log.push(`👹 **${combat.enemyName}** menyerang ${classes[targetPlayer.class].name}! (-${dmgToPlayer} HP)`);

      if (targetPlayer.hp <= 0) {
        targetPlayer.alive = false;
        log.push(`💀 **${classes[targetPlayer.class].name}** tumbang!`);

        if (session.inventory) {
           const amuletIndex = session.inventory.findIndex(i => i.itemType === 'amulet_revive');
           if (amuletIndex !== -1) {
             session.inventory.splice(amuletIndex, 1);
             targetPlayer.alive = true;
             targetPlayer.hp = Math.floor(targetPlayer.maxHp * 0.5);
             log.push(`💠 **Jimat Kebangkitan** bersinar! ${classes[targetPlayer.class].name} bangkit kembali dengan 50% HP!`);
           }
        }
      }
    }

    // Telegraph setup for next turn
    if (combat.enemyId === 'penjaga_terkutuk' && (combat.turnNumber) % 3 === 0) {
      combat.telegraphActive = true;
      log.push(`⚠️ **Penjaga Terkutuk** mengangkat kapaknya tinggi-tinggi... (serangan berat turn depan!)`);
    } else if (combat.enemyId === 'raja_terkutuk' && (combat.turnNumber) % 2 === 0) {
      combat.telegraphActive = true;
      log.push(`⚠️ **Raja Terkutuk** memusatkan energi gelap... (serangan fatal turn depan!)`);
    }
  }

  // End of Turn Cooldown and Buff reset
  for (const chatId of playerIds) {
    if (session.players[chatId].skillCooldown > 0) {
      session.players[chatId].skillCooldown--;
    }
    session.players[chatId].buffs.defending = false;
  }

  combat.turnNumber++;
  return log;
}

module.exports = { resolveTurn, renderHpBar };
