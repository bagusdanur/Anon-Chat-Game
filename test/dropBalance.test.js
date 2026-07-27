const test = require('node:test');
const assert = require('node:assert/strict');
const bosses = require('../data/rpg_bosses.json').bosses;
const {
  effectiveDropChance,
  rollDrop,
} = require('../src/rpg/services/dropBalance');

test('classic raid legendary chance is bounded and never guaranteed by default', () => {
  for (const boss of bosses) {
    assert.ok(boss.legendaryDropChance > 0);
    assert.ok(boss.legendaryDropChance <= 0.15);
    assert.equal(rollDrop(boss.legendaryDropChance, 1, () => 0), true);
    assert.equal(rollDrop(boss.legendaryDropChance, 1, () => 0.99), false);
  }
  assert.equal(effectiveDropChance(0.15, 10), 1);
  assert.equal(effectiveDropChance(0.15, -1), 0);
});
