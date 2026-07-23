const classDefinitions = require('../../../data/rpg_classes.json');

function classStats(classDef, level) {
  const primaryGrowth = classDef.damageType === 'magic'
    ? classDef.growth.magic_atk
    : classDef.growth.atk;
  const primaryBase = classDef.damageType === 'magic'
    ? classDef.base_magic_atk
    : classDef.base_atk;
  return {
    hp: Math.floor(classDef.base_hp + classDef.growth.hp * (level - 1)),
    attack: Math.floor(primaryBase + primaryGrowth * (level - 1)),
    defense: Math.floor(classDef.base_def + classDef.growth.def * (level - 1)),
    critRate: Math.min(0.5, classDef.base_crit_rate + (level - 1) * (classDef.growth.crit_rate || 0.005)),
    critMulti: classDef.base_crit_multi,
  };
}

function averageBaseStats(level) {
  const all = classDefinitions.map(classDef => classStats(classDef, level));
  const average = key => all.reduce((sum, stats) => sum + stats[key], 0) / all.length;
  return {
    hp: average('hp'),
    attack: average('attack'),
    defense: average('defense'),
  };
}

// Musuh hunt mengikuti level, bukan memakai satu angka datar untuk puluhan level.
// Gear tetap terasa karena scaling hanya memakai stat dasar class, bukan stat pemain.
function buildHuntMonster(level, random = Math.random) {
  const baseline = averageBaseStats(level);
  const variance = 0.9 + random() * 0.2;
  return {
    hp: Math.max(15, Math.round(baseline.attack * 5 * variance)),
    attack: Math.max(3, Math.round((baseline.defense / 2 + baseline.hp * 0.065) * variance)),
    defense: Math.max(1, Math.floor(level / 10)),
  };
}

function randomInt(min, max, random) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function simulateHuntBattle(player, monster, random = Math.random) {
  let playerHp = player.hp;
  let monsterHp = monster.hp;
  let rounds = 0;
  while (playerHp > 0 && monsterHp > 0 && rounds < 20) {
    let dealt = Math.max(
      1,
      player.attack - Math.floor(monster.defense / 2) + randomInt(-1, 2, random),
    );
    if (random() < (player.critRate || 0)) {
      dealt = Math.max(1, Math.floor(dealt * (player.critMulti || 1.5)));
    }
    monsterHp -= dealt;
    if (monsterHp > 0) {
      playerHp -= Math.max(
        1,
        monster.attack - Math.floor(player.defense / 2) + randomInt(-1, 2, random),
      );
    }
    rounds++;
  }
  const remainingHp = Math.max(0, playerHp);
  return {
    win: monsterHp <= 0,
    rounds,
    remainingHp,
    damageTaken: player.hp - remainingHp,
  };
}

module.exports = {
  classStats,
  buildHuntMonster,
  simulateHuntBattle,
};
