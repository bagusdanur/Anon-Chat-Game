// src/rpg/grind.js
// Fase 2: /hunt, /fish, /mine + sistem energi
const {
  getOrCreateUser, getCurrentEnergy, spendEnergy, getCurrentHp,
  addXp, addGold, addItem, updateHp, CLASS_DEFS
} = require('./db_rpg');
const { RARITY_EMOJI } = require('./profile');

// ===== MONSTER TABLES =====
const MONSTERS = [
  { tier: 1, minLv: 1,  maxLv: 10, list: ['Slime Hijau','Goblin Kecil','Babi Hutan'],   hp: [15,25], atk: [2,4],  xp: [12,20], gold: [5,15]  },
  { tier: 2, minLv: 11, maxLv: 25, list: ['Orc Perampok','Laba-laba Raksasa','Bandit'], hp: [30,50], atk: [5,9],  xp: [30,55], gold: [20,45] },
  { tier: 3, minLv: 26, maxLv: 50, list: ['Troll Hutan','Wyvern Muda','Kultis Gelap'], hp: [60,100],atk: [10,16],xp: [70,130],gold: [50,100]},
  { tier: 4, minLv: 51, maxLv: 999,list: ['Naga Muda','Lich Tua','Ksatria Terkutuk'], hp: [120,200],atk:[18,28], xp:[180,320],gold:[120,250]},
];

// ===== LOOT TABLES PER AKTIVITAS =====
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
const MINE_LOOT_T1 = { common: ['tembaga','batu_bara'], uncommon: ['tembaga'], rare: [], epic: [], legendary: [] };
const MINE_LOOT_T2 = { common: ['batu_bara'], uncommon: ['besi'], rare: ['perak'], epic: [], legendary: [] };
const MINE_LOOT_T3 = { common: ['besi'], uncommon: ['perak'], rare: ['emas_ore'], epic: ['emas_ore'], legendary: ['berlian'] };

const RARITY_ROLLS = [
  { rarity: 'legendary', threshold: 0.002 },
  { rarity: 'epic',      threshold: 0.02  },
  { rarity: 'rare',      threshold: 0.10  },
  { rarity: 'uncommon',  threshold: 0.30  },
  { rarity: 'common',    threshold: 1.00  },
];

function rollRarity(boost = 0) {
  const r = Math.random();
  for (const entry of RARITY_ROLLS) {
    const adjustedThreshold = Math.min(entry.threshold * (1 + boost * 0.5), 1);
    if (r < adjustedThreshold) return entry.rarity;
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

// Quick battle simulation untuk /hunt
function simulateBattle(playerAtk, playerDef, playerHp, monsterHp, monsterAtk, monsterDef, className) {
  let pHp = playerHp;
  let mHp = monsterHp;
  let rounds = 0;
  while (pHp > 0 && mHp > 0 && rounds < 20) {
    const playerDmg = Math.max(1, playerAtk - Math.floor(monsterDef / 2) + randInt(-1, 2));
    const monsterDmg = Math.max(1, monsterAtk - Math.floor(playerDef / 2) + randInt(-1, 2));
    mHp -= playerDmg;
    if (mHp > 0) pHp -= monsterDmg;
    rounds++;
  }
  return { win: mHp <= 0, remainingHp: Math.max(0, pHp), damageTaken: playerHp - Math.max(0, pHp) };
}

function setupGrind(bot, { rateLimitCommand }) {
  // Cooldown anti-spam
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
      const minsUntilRegen = (5 - Math.floor(((Date.now() / 1000) - user.energy_last_update) / 60) % 5);
      return ctx.reply(`⚡ Energimu cuma ${energy}/10. Butuh ${energyCost} buat /hunt. Regen +1 dalam ~${minsUntilRegen} menit.`);
    }

    // Cek HP SEBELUM spend energy (energy baru dikurangi jika HP cukup)
    const currentHp = getCurrentHp(user);
    if (currentHp <= 0) {
      return ctx.reply('❤️ HP kamu habis! Pakai /inv lalu gunakan Ramuan untuk pulih, atau tunggu regen otomatis.');
    }

    spendEnergy(userId, energyCost);

    const tier = getMonsterTier(user.level);
    const monster = pickRandom(tier.list);
    const mHp = randInt(...tier.hp);
    const mAtk = randInt(...tier.atk);
    const result = simulateBattle(user.atk, user.def, currentHp, mHp, mAtk, 1, user.class_name);

    let msg = `⚔️ **Berburu** ⚔️\n\nKamu menjumpai **${monster}**!\n`;

    if (result.win) {
      let xpGain = randInt(...tier.xp);
      let goldGain = randInt(...tier.gold);
      // Trait Penyihir: +25% XP dari semua grinding
      if (user.class_name === 'penyihir') xpGain = Math.floor(xpGain * 1.25);
      // Trait Pencuri: +gold per 5 level (maks +25%)
      if (user.class_name === 'pencuri') {
        const bonus = Math.min(0.25, Math.floor(user.level / 5) * 0.02);
        goldGain = Math.floor(goldGain * (1 + bonus));
      }

      msg += `\n💥 Damage diterima: ${result.damageTaken}\n`;
      msg += `\n🏆 **Menang!**\n`;
      msg += `✨ +${xpGain} XP | 💰 +${goldGain}g\n`;

      // Loot roll
      const rarity = rollRarity();
      const lootTable = getLootTable('hunt', user.level);
      const itemOptions = lootTable[rarity] || lootTable.common;
      const item = pickRandom(itemOptions);
      if (item) {
        addItem(userId, item);
        msg += `${RARITY_EMOJI[rarity]} Loot: **${item.replace(/_/g, ' ')}**\n`;
      }

      const { leveled, newLevel } = addXp(userId, xpGain);
      addGold(userId, goldGain);
      const newHp = Math.max(1, currentHp - result.damageTaken);
      updateHp(userId, newHp);

      if (leveled && leveled.length > 0) {
        msg += `\n🎉 **LEVEL UP!** Kamu sekarang Level **${newLevel}**! Stats meningkat!`;
      }
    } else {
      msg += `\n💥 Kamu kewalahan dan terpaksa kabur!\n`;
      msg += `❤️ HP berkurang signifikan. Istirahatlah sebentar.`;
      const newHp = Math.max(1, Math.floor(currentHp * 0.3));
      updateHp(userId, newHp);
    }

    ctx.reply(msg, { parse_mode: 'Markdown' });
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
      return ctx.reply(`⚡ Energimu cuma ${energy}/10. Butuh ${energyCost} buat /fish. Regen +1 tiap 5 menit.`);
    }

    spendEnergy(userId, energyCost);

    const lootTable = getLootTable('fish', user.level);
    const rarity = rollRarity();
    const itemOptions = lootTable[rarity];
    const item = pickRandom(itemOptions.length ? itemOptions : lootTable.common);

    // Hitung XP dulu, jangan panggil addXp dua kali
    let xpGain = randInt(5, 15);
    // Trait Penyihir: +25% XP dari semua grinding
    if (user.class_name === 'penyihir') xpGain = Math.floor(xpGain * 1.25);

    let msg = `🎣 **Mancing** 🎣\n\nKamu melempar kail ke sungai...\n\n`;
    if (item === 'sepatu_rusak') {
      msg += `👟 Dapat **Sepatu Bot Rusak**... ya sudahlah. (0g)\n`;
      addItem(userId, 'sepatu_rusak');
    } else if (item) {
      addItem(userId, item);
      const sellHint = lootTable[rarity].length ? ` _(jual: /sell ${item.replace(/_/g,' ')})_` : '';
      msg += `${RARITY_EMOJI[rarity]} Dapat: **${item.replace(/_/g, ' ')}**${sellHint}\n`;
    } else {
      msg += `Tidak dapat apa-apa... Coba lagi!\n`;
    }
    msg += `\n✨ +${xpGain} XP\n_Lihat /inv untuk menjual item_`;

    // Satu kali addXp, cek level-up
    const { leveled, newLevel } = addXp(userId, xpGain);
    if (leveled && leveled.length > 0) {
      msg += `\n\n🎉 **LEVEL UP!** Kamu sekarang Level **${newLevel}**! Stats meningkat!`;
    }
    ctx.reply(msg, { parse_mode: 'Markdown' });
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
      return ctx.reply(`⚡ Energimu cuma ${energy}/10. Butuh ${energyCost} buat /mine. Regen +1 tiap 5 menit.`);
    }

    spendEnergy(userId, energyCost);

    const lootTable = getLootTable('mine', user.level);
    const rarity = rollRarity();
    const itemOptions = lootTable[rarity];
    const item = pickRandom(itemOptions.length ? itemOptions : lootTable.common);

    if (item) addItem(userId, item);

    // Gold kecil dari menambang (bonus mining)
    const mineGoldRange = user.level <= 20 ? [3, 10] : user.level <= 45 ? [10, 25] : [25, 60];
    let goldGain = randInt(...mineGoldRange);
    if (user.class_name === 'pencuri') {
      const bonus = Math.min(0.25, Math.floor(user.level / 5) * 0.02);
      goldGain = Math.floor(goldGain * (1 + bonus));
    }

    let xpGain = randInt(3, 10);
    if (user.class_name === 'penyihir') xpGain = Math.floor(xpGain * 1.25);

    const { leveled, newLevel } = addXp(userId, xpGain);
    addGold(userId, goldGain);

    let msg = `⛏️ **Menambang** ⛏️\n\nKamu memukul batu dengan beliungmu...\n\n`;
    if (item) {
      msg += `${RARITY_EMOJI[rarity]} Dapat: **${item.replace(/_/g, ' ')}**\n`;
    } else {
      msg += `Tidak ada yang tergali saat ini...\n`;
    }
    msg += `💰 +${goldGain}g | ✨ +${xpGain} XP\n_Lihat /inv atau jual /sell_`;

    if (leveled && leveled.length > 0) {
      msg += `\n\n🎉 **LEVEL UP!** Kamu sekarang Level **${newLevel}**! Stats meningkat!`;
    }
    ctx.reply(msg, { parse_mode: 'Markdown' });
  });
}

module.exports = { setupGrind };
