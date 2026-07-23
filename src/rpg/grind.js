// src/rpg/grind.js
// Fase 2: /hunt, /fish, /mine + sistem energi — Discord game bot style
const {
  getOrCreateUser, getCurrentEnergy, spendEnergy, getCurrentHp,
  addXp, addGold, addItem, updateHp, CLASS_DEFS,
  incrementQuestProgress, getEquippedItem, getEquippedBonus
} = require('./db_rpg');
const { RARITY_EMOJI } = require('./profile');
const { getGameSettings } = require('./config');
const { db } = require('../db');
const { createProfessionService } = require('./services/professions');
const { createEquipmentService } = require('./services/equipment');
const { buildHuntMonster, simulateHuntBattle } = require('./services/combatBalance');

const professionService = createProfessionService(db);
const equipmentV2 = createEquipmentService(db);

const fs = require('fs');
const path = require('path');

function getGrindConfig() {
  try {
    const configPath = path.join(__dirname, '../../data/rpg_monsters.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load rpg_monsters.json:', e);
  }
  // Fallback defaults if file deleted
  return {
    monsters: [],
    hunt_loot: { common: [], uncommon: [], rare: [], epic: [], legendary: [] },
    fish_loot: { t1: {}, t2: {}, t3: {} },
    mine_loot: { t1: {}, t2: {}, t3: {} },
    rarity_rolls: [ { rarity: 'common', threshold: 1.0 } ]
  };
}

function rollRarity(boost = 0) {
  const settings = getGameSettings();
  const config = getGrindConfig();
  const globalDropBoost = settings.drop_rate_multiplier - 1.0;
  const totalBoost = boost + globalDropBoost;
  
  const r = Math.random();
  for (const entry of config.rarity_rolls) {
    const adj = Math.min(entry.threshold * (1 + totalBoost * 0.5), 1);
    if (r < adj) return entry.rarity;
  }
  return 'common';
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getMonsterTier(level) {
  const config = getGrindConfig();
  return config.monsters.find(m => level >= m.minLv && level <= m.maxLv) || config.monsters[0];
}

function getLootTable(activity, user) {
  const config = getGrindConfig();
  if (activity === 'fish') {
    if (user.level <= 15) return config.fish_loot.t1;
    if (user.level <= 35) return config.fish_loot.t2;
    return config.fish_loot.t3;
  }
  if (activity === 'mine') {
    if (user.level <= 20) return config.mine_loot.t1;
    if (user.level <= 45) return config.mine_loot.t2;
    return config.mine_loot.t3;
  }
  return config.hunt_loot;
}

function setupGrind(bot, { rateLimitCommand }) {
  const cmdCooldown = new Map();
  function isOnCooldown(userId, cmd, ms = 2000) {
    const key = `${userId}:${cmd}`;
    const last = cmdCooldown.get(key) || 0;
    if (Date.now() - last < ms) return true;
    cmdCooldown.set(key, Date.now());
    return false;
  }

  // ===== /hunt =====
  bot.command('hunt', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    if (isOnCooldown(userId, 'hunt')) return;

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const energyCost = 2;
    const energy = getCurrentEnergy(user);
    if (energy < energyCost) {
      return ctx.reply(
        `⚡ <b>Energi tidak cukup!</b>\n\n` +
        `Energi: <b>${energy}/10</b> (butuh ${energyCost})\n` +
        `<i>Regen +1 setiap 3 menit otomatis</i>\n` +
        `atau /use ramuan_energi`,
        { parse_mode: 'HTML' }
      );
    }

    const currentHp = getCurrentHp(user);
    if (currentHp <= 0) {
      return ctx.reply(
        `❤️ <b>HP habis!</b>\n\n` +
        `Pakai /inv → /use ramuan untuk pulih\n` +
        `atau tunggu regen otomatis (+15% per 5 menit)`,
        { parse_mode: 'HTML' }
      );
    }

    spendEnergy(userId, energyCost);

    const legacyBonus = getEquippedBonus(userId);
    const instanceBonus = equipmentV2.bonuses(userId);
    const classDef = CLASS_DEFS[user.class_name];
    const playerAtk = classDef.damageType === 'magic'
      ? (user.magic_atk || 0) + legacyBonus.magicAtkBonus + (instanceBonus.magic_atk || 0)
      : user.atk + legacyBonus.atkBonus + (instanceBonus.atk || 0);
    const playerDef = user.def + legacyBonus.defBonus + (instanceBonus.def || 0);
    const tier = getMonsterTier(user.level);
    const monster = pickRandom(tier.list);
    const scaledMonster = buildHuntMonster(user.level);
    const result = simulateHuntBattle({
      hp: currentHp,
      attack: playerAtk,
      defense: playerDef,
      critRate: user.crit_rate + legacyBonus.critBonus + (instanceBonus.crit_rate || 0),
      critMulti: user.crit_multi,
    }, scaledMonster);

    let msg = `<b>⚔️ BERBURU</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Kamu menemukan <b>${monster}</b>!\n\n`;

    if (result.win) {
      const settings = getGameSettings();
      let xpGain   = Math.floor(randInt(...tier.xp) * settings.exp_multiplier);
      let goldGain = Math.floor(randInt(...tier.gold) * settings.gold_multiplier);
      
      if (user.class_name === 'penyihir') xpGain = Math.floor(xpGain * 1.25);
      if (user.class_name === 'pencuri') {
        const bonus = Math.min(0.25, Math.floor(user.level / 5) * 0.02);
        goldGain = Math.floor(goldGain * (1 + bonus));
      }

      const rarity    = rollRarity();
      const lootTable = getLootTable('hunt', user);
      const itemOpts  = lootTable[rarity] || lootTable.common;
      const item      = pickRandom(itemOpts);

      msg += `✅ <b>MENANG!</b>\n`;
      msg += `⏱️ Pertarungan: <b>${result.rounds} turn</b>\n`;
      msg += `💥 Damage diterima: <b>${result.damageTaken}</b>\n`;
      msg += `✨ +<b>${xpGain}</b> XP   💰 +<b>${goldGain}</b>g\n`;
      if (item) {
        msg += `${RARITY_EMOJI[rarity]} Loot: <b>${item.replace(/_/g, ' ')}</b>\n`;
        addItem(userId, item);
      }

      const { leveled, newLevel } = addXp(userId, xpGain);
      addGold(userId, goldGain);
      incrementQuestProgress(userId, 'hunt');
      professionService.grantXp(userId, 'hunting', 10, `telegram:${ctx.update.update_id}:hunt`);
      const newHp = Math.max(1, currentHp - result.damageTaken);
      updateHp(userId, newHp);

      const hpBar = (() => {
        const len = 8;
        const f = Math.min(len, Math.round((newHp / user.max_hp) * len));
        return '█'.repeat(f) + '░'.repeat(len - f);
      })();
      msg += `\n❤️ HP: ${hpBar} <code>${newHp}/${user.max_hp}</code>`;

      if (leveled && leveled.length > 0) {
        msg += `\n\n🎉 <b>LEVEL UP!</b> → Lv <b>${newLevel}</b>! Stats meningkat!`;
      }
      msg += `\n\n<i>💡 Hunt cepat untuk XP. Untuk combat pilihan Attack/Defend/Skill gunakan /dungeon.</i>`;
    } else {
      const newHp = Math.max(1, Math.floor(currentHp * 0.3));
      updateHp(userId, newHp);
      msg += `💀 <b>KABUR!</b>\n`;
      msg += `Musuh terlalu kuat, kamu terpaksa kabur!\n`;
      msg += `❤️ HP tersisa: <b>${newHp}/${user.max_hp}</b>`;
      msg += `\n\n<i>💡 Pulihkan HP, cek /gear dan /skill, atau main duo lewat /dungeon.</i>`;
    }

    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /fish =====
  bot.command('fish', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    if (isOnCooldown(userId, 'fish')) return;

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const energyCost = 1;
    const energy = getCurrentEnergy(user);
    if (energy < energyCost) {
      return ctx.reply(`⚡ <b>Energi tidak cukup!</b>\nEnergi: <b>${energy}/10</b> (butuh ${energyCost})\n<i>Regen +1 tiap 3 menit</i>`, { parse_mode: 'HTML' });
    }

    spendEnergy(userId, energyCost);

    const lootTable = getLootTable('fish', user);
    const rarity    = rollRarity();
    const itemOpts  = lootTable[rarity];
    const item      = pickRandom(itemOpts && itemOpts.length ? itemOpts : lootTable.common);

    const settings = getGameSettings();
    let xpGain = Math.floor(randInt(5, 15) * settings.exp_multiplier);
    if (user.class_name === 'penyihir') xpGain = Math.floor(xpGain * 1.25);

    let msg = `<b>🎣 MANCING</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Kamu melempar kail ke sungai...\n\n`;

    if (item === 'sepatu_rusak') {
      msg += `👟 Dapat <b>Sepatu Bot Rusak</b>... ya sudahlah\n`;
      addItem(userId, 'sepatu_rusak');
    } else if (item) {
      msg += `${RARITY_EMOJI[rarity]} Dapat: <b>${item.replace(/_/g, ' ')}</b>\n`;
      addItem(userId, item);
    } else {
      msg += `Tidak dapat apa-apa... Coba lagi!\n`;
    }

    const { leveled, newLevel } = addXp(userId, xpGain);
    incrementQuestProgress(userId, 'fish');
    professionService.grantXp(userId, 'fishing', 8, `telegram:${ctx.update.update_id}:fish`);
    msg += `✨ +<b>${xpGain}</b> XP`;
    if (leveled && leveled.length > 0) {
      msg += `\n\n🎉 <b>LEVEL UP!</b> → Lv <b>${newLevel}</b>!`;
    }
    msg += `\n<i>/inv untuk lihat inventaris</i>`;

    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /mine =====
  bot.command('mine', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    if (isOnCooldown(userId, 'mine')) return;

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const energyCost = 3;
    const energy = getCurrentEnergy(user);
    if (energy < energyCost) {
      return ctx.reply(`⚡ <b>Energi tidak cukup!</b>\nEnergi: <b>${energy}/10</b> (butuh ${energyCost})\n<i>Regen +1 tiap 3 menit</i>`, { parse_mode: 'HTML' });
    }

    spendEnergy(userId, energyCost);

    const lootTable = getLootTable('mine', user.level);
    const rarity    = rollRarity();
    const itemOpts  = lootTable[rarity];
    const item      = pickRandom(itemOpts.length ? itemOpts : lootTable.common);

    // BAL-01 FIX: naikkan gold reward agar mine lebih kompetitif vs fish/hunt
    const settings = getGameSettings();
    const mineGoldRange = user.level <= 20 ? [8, 18] : user.level <= 45 ? [15, 35] : [30, 70];
    let goldGain = Math.floor(randInt(...mineGoldRange) * settings.gold_multiplier);
    if (user.class_name === 'pencuri') {
      const bonus = Math.min(0.25, Math.floor(user.level / 5) * 0.02);
      goldGain = Math.floor(goldGain * (1 + bonus));
    }

    // BAL-01 FIX: naikkan XP dari 3-10 ke 8-20 (mine itu susah, pantas dapat XP lebih)
    let xpGain = Math.floor(randInt(8, 20) * settings.exp_multiplier);
    if (user.class_name === 'penyihir') xpGain = Math.floor(xpGain * 1.25);

    // BAL-01 FIX: 10% chance dapat double ore (bonus unik mining)
    const doubleOre = item && Math.random() < 0.10;
    if (item) addItem(userId, item);
    if (doubleOre) addItem(userId, item); // second copy

    const { leveled, newLevel } = addXp(userId, xpGain);
    addGold(userId, goldGain);
    incrementQuestProgress(userId, 'mine');
    professionService.grantXp(userId, 'mining', 12, `telegram:${ctx.update.update_id}:mine`);

    let msg = `<b>⛏️ MENAMBANG</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Kamu memukul batu dengan beliungmu...\n\n`;
    if (item) {
      msg += `${RARITY_EMOJI[rarity]} Dapat: <b>${item.replace(/_/g, ' ')}</b>${doubleOre ? ' ×2 <b>🎉 Double Ore!</b>' : ''}\n`;
    } else {
      msg += `Tidak ada yang tergali saat ini...\n`;
    }
    msg += `✨ +<b>${xpGain}</b> XP   💰 +<b>${goldGain}</b>g`;
    if (leveled && leveled.length > 0) {
      msg += `\n\n🎉 <b>LEVEL UP!</b> → Lv <b>${newLevel}</b>!`;
    }
    msg += `\n<i>/inv untuk lihat inventaris</i>`;

    ctx.reply(msg, { parse_mode: 'HTML' });
  });
}


module.exports = { setupGrind };
