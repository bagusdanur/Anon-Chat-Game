// src/rpg/grind.js
// Fase 2: /hunt, /fish, /mine + sistem energi — Discord game bot style
const {
  getOrCreateUser, getCurrentEnergy, spendEnergy, getCurrentHp,
  addXp, addGold, addItem, updateHp, CLASS_DEFS,
  incrementQuestProgress
} = require('./db_rpg');
const { RARITY_EMOJI } = require('./profile');
const { getGameSettings } = require('./config');

// ===== MONSTER TABLES =====
const MONSTERS = [
  { tier: 1, minLv: 1,  maxLv: 10, list: ['🟢 Slime Hijau','👺 Goblin Kecil','🐗 Babi Hutan'],   hp: [15,25], atk: [2,4],  xp: [12,20], gold: [5,15]  },
  { tier: 2, minLv: 11, maxLv: 25, list: ['👹 Orc Perampok','🕷️ Laba-laba Raksasa','🗡️ Bandit'], hp: [30,50], atk: [5,9],  xp: [30,55], gold: [20,45] },
  { tier: 3, minLv: 26, maxLv: 50, list: ['🌲 Troll Hutan','🐉 Wyvern Muda','👤 Kultis Gelap'], hp: [60,100],atk: [10,16],xp: [70,130],gold: [50,100]},
  { tier: 4, minLv: 51, maxLv: 999,list: ['🐲 Naga Muda','💀 Lich Tua','⚔️ Ksatria Terkutuk'], hp: [120,200],atk:[18,28], xp:[180,320],gold:[120,250]},
];

const HUNT_LOOT = {
  common:    ['daging_mentah', 'kulit_kasar'],
  uncommon:  ['ramuan_kecil', 'besi_rongsok'],
  rare:      ['pedang_karatan'],
  epic:      ['jubah_terkutuk'],
  legendary: ['fragmen_naga'],
};
const FISH_LOOT_T1 = { common: ['ikan_teri','ikan_mujair','sepatu_rusak'], uncommon: ['ikan_teri'], rare: [], epic: [], legendary: [] };
const FISH_LOOT_T2 = { common: ['ikan_mujair'], uncommon: ['ikan_salmon','kepiting'], rare: ['ikan_salmon'], epic: [], legendary: [] };
const FISH_LOOT_T3 = { common: ['ikan_mujair'], uncommon: ['kepiting'], rare: ['kepiting'], epic: ['mutiara'], legendary: ['mutiara'] };
const MINE_LOOT_T1 = { common: ['tembaga','batu_bara'], uncommon: ['tembaga', 'besi_rongsok'], rare: ['besi_rongsok'], epic: [], legendary: [] };
const MINE_LOOT_T2 = { common: ['batu_bara'], uncommon: ['besi'], rare: ['perak'], epic: [], legendary: [] };
const MINE_LOOT_T3 = { common: ['besi'], uncommon: ['perak'], rare: ['emas_ore'], epic: ['emas_ore'], legendary: ['berlian'] };

const RARITY_ROLLS = [
  { rarity: 'legendary', threshold: 0.005 },
  { rarity: 'epic',      threshold: 0.02  },
  { rarity: 'rare',      threshold: 0.10  },
  { rarity: 'uncommon',  threshold: 0.30  },
  { rarity: 'common',    threshold: 1.00  },
];

function rollRarity(boost = 0) {
  const settings = getGameSettings();
  const globalDropBoost = settings.drop_rate_multiplier - 1.0;
  const totalBoost = boost + globalDropBoost;
  
  const r = Math.random();
  for (const entry of RARITY_ROLLS) {
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
  return MONSTERS.find(m => level >= m.minLv && level <= m.maxLv) || MONSTERS[0];
}

function getLootTable(activity, level) {
  if (activity === 'fish') {
    if (level <= 15) return FISH_LOOT_T1;
    if (level <= 35) return FISH_LOOT_T2;
    return FISH_LOOT_T3;
  }
  if (activity === 'mine') {
    if (level <= 20) return MINE_LOOT_T1;
    if (level <= 45) return MINE_LOOT_T2;
    return MINE_LOOT_T3;
  }
  return HUNT_LOOT;
}

function simulateBattle(playerAtk, playerDef, playerHp, monsterHp, monsterAtk, monsterDef, className) {
  let pHp = playerHp, mHp = monsterHp, rounds = 0;
  while (pHp > 0 && mHp > 0 && rounds < 20) {
    const playerDmg  = Math.max(1, playerAtk - Math.floor(monsterDef / 2) + randInt(-1, 2));
    const monsterDmg = Math.max(1, monsterAtk - Math.floor(playerDef / 2) + randInt(-1, 2));
    mHp -= playerDmg;
    if (mHp > 0) pHp -= monsterDmg;
    rounds++;
  }
  return { win: mHp <= 0, remainingHp: Math.max(0, pHp), damageTaken: playerHp - Math.max(0, pHp) };
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
        `atau tunggu regen otomatis (+10% per 10 menit)`,
        { parse_mode: 'HTML' }
      );
    }

    spendEnergy(userId, energyCost);

    const tier = getMonsterTier(user.level);
    const monster = pickRandom(tier.list);
    const mHp  = randInt(...tier.hp);
    const mAtk = randInt(...tier.atk);
    const result = simulateBattle(user.atk, user.def, currentHp, mHp, mAtk, 1, user.class_name);

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
      const lootTable = getLootTable('hunt', user.level);
      const itemOpts  = lootTable[rarity] || lootTable.common;
      const item      = pickRandom(itemOpts);

      msg += `✅ <b>MENANG!</b>\n`;
      msg += `💥 Damage diterima: <b>${result.damageTaken}</b>\n`;
      msg += `✨ +<b>${xpGain}</b> XP   💰 +<b>${goldGain}</b>g\n`;
      if (item) {
        msg += `${RARITY_EMOJI[rarity]} Loot: <b>${item.replace(/_/g, ' ')}</b>\n`;
        addItem(userId, item);
      }

      const { leveled, newLevel } = addXp(userId, xpGain);
      addGold(userId, goldGain);
      incrementQuestProgress(userId, 'hunt');
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
    } else {
      const newHp = Math.max(1, Math.floor(currentHp * 0.3));
      updateHp(userId, newHp);
      msg += `💀 <b>KABUR!</b>\n`;
      msg += `Musuh terlalu kuat, kamu terpaksa kabur!\n`;
      msg += `❤️ HP tersisa: <b>${newHp}/${user.max_hp}</b>`;
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

    const lootTable = getLootTable('fish', user.level);
    const rarity    = rollRarity();
    const itemOpts  = lootTable[rarity];
    const item      = pickRandom(itemOpts.length ? itemOpts : lootTable.common);

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
