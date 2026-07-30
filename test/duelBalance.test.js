const test = require('node:test');
const assert = require('node:assert/strict');
const {
  arenaHp,
  pvpCritRate,
  pvpCritMultiplier,
  pvpDamage,
  pvpBurnDamage,
  canDuel,
} = require('../src/rpg/services/duelBalance');

test('duel arena applies PvP-only health, damage, crit, and burn caps', () => {
  assert.equal(arenaHp(500), 425);
  assert.equal(pvpDamage(100), 55);
  assert.equal(pvpDamage(999, 400), 180);
  assert.equal(pvpCritRate(0.9), 0.25);
  assert.equal(pvpCritMultiplier(2.5), 1.6);
  assert.equal(pvpBurnDamage(999, 400), 24);
});

test('duel rejects extreme level gaps while allowing comparable partners', () => {
  assert.equal(canDuel({ level: 55 }, { level: 45 }).success, true);
  assert.equal(canDuel({ level: 55 }, { level: 44 }).success, false);
});
