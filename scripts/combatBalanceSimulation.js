const classes = require('../data/rpg_classes.json');
const {
  classStats,
  buildHuntMonster,
  simulateHuntBattle,
} = require('../src/rpg/services/combatBalance');

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const levels = [1, 3, 7, 10, 11, 20, 25, 26, 40, 50, 51, 75];
const samples = Number(process.argv[2] || 5000);
const rows = [];

for (const level of levels) {
  for (const classDef of classes) {
    const random = seededRandom(level * 1000 + classDef.id.length);
    const base = classStats(classDef, level);
    let wins = 0;
    let rounds = 0;
    let damage = 0;
    for (let index = 0; index < samples; index++) {
      const result = simulateHuntBattle(base, buildHuntMonster(level, random), random);
      if (result.win) wins++;
      rounds += result.rounds;
      damage += result.damageTaken;
    }
    rows.push({
      level,
      class: classDef.id,
      win: `${(wins / samples * 100).toFixed(1)}%`,
      turns: (rounds / samples).toFixed(1),
      hpCost: `${(damage / samples / base.hp * 100).toFixed(1)}%`,
    });
  }
}

console.table(rows);
