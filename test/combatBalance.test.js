const test = require('node:test');
const assert = require('node:assert/strict');
const classes = require('../data/rpg_classes.json');
const {
  classStats,
  buildHuntMonster,
  simulateHuntBattle,
} = require('../src/rpg/services/combatBalance');
const dungeons = require('../data/rpg_dungeons.json');
const raids = require('../data/rpg_raids.json');

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test('hunt tidak kembali menjadi pertarungan satu turn tanpa tekanan HP', () => {
  for (const level of [1, 7, 20, 40, 75]) {
    for (const classDef of classes) {
      const random = seededRandom(level * 100 + classDef.id.length);
      const player = classStats(classDef, level);
      let turns = 0;
      let hpCost = 0;
      const samples = 2000;
      for (let index = 0; index < samples; index++) {
        const result = simulateHuntBattle(player, buildHuntMonster(level, random), random);
        turns += result.rounds;
        hpCost += result.damageTaken / player.hp;
      }
      const averageTurns = turns / samples;
      const averageHpCost = hpCost / samples;
      assert.ok(averageTurns >= 3, `${classDef.id} Lv${level} terlalu cepat: ${averageTurns}`);
      assert.ok(averageTurns <= 8, `${classDef.id} Lv${level} terlalu lambat: ${averageTurns}`);
      assert.ok(averageHpCost >= 0.1, `${classDef.id} Lv${level} tidak menerima tekanan HP`);
      assert.ok(averageHpCost <= 0.45, `${classDef.id} Lv${level} menerima damage berlebihan`);
    }
  }
});

test('dungeon pertama menyatakan level rekomendasi boss dengan jujur', () => {
  const firstDungeon = dungeons.find(dungeon => dungeon.id === 'goblin_ruins');
  assert.ok(firstDungeon.recommended_level >= 7);
});

test('weekly duo raid dapat diselesaikan pada level minimum dengan seluruh attempt', () => {
  const weekly = raids.raids.find(raid => raid.type === 'party');
  const totalConservativeDamage = classes.reduce((sum, classDef) => {
    const stats = classStats(classDef, weekly.minLevel);
    return sum + Math.floor(stats.attack * 1.8 + stats.defense * 0.5 + weekly.minLevel * 4);
  }, 0) / classes.length * 2 * weekly.attemptLimit;
  assert.ok(
    totalConservativeDamage >= weekly.maxHp,
    `HP weekly raid ${weekly.maxHp} tidak terjangkau duo level minimum (${totalConservativeDamage})`,
  );
});
