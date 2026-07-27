const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enemyMaxHp,
  combinedPower,
  outgoingDamage,
  incomingDamage,
} = require('../src/rpg/services/dungeonCombatBalance');

test('shared dungeon balance formulas preserve production tactical values', () => {
  const combat = { type: 'combat', enemy: { power: 20, damage: 10 } };
  const boss = { type: 'boss', enemy: { power: 20, damage: 10 } };
  assert.equal(enemyMaxHp(combat, 'solo'), 100);
  assert.equal(enemyMaxHp(boss, 'solo'), 280);
  assert.equal(enemyMaxHp(boss, 'duo'), 462);
  assert.equal(combinedPower(100, 80, true), 124);
  assert.equal(combinedPower(100, 15, false), 115);
  assert.equal(outgoingDamage({
    power: 100, action: 'attack', random: () => 0.5,
  }), 50);
  assert.equal(outgoingDamage({
    power: 100, action: 'skill', skillMultiplier: 2, random: () => 0.5,
  }), 95);
  assert.equal(incomingDamage({
    enemyDamage: 10, mode: 'duo', action: 'defend',
  }), 4);
  assert.equal(incomingDamage({
    enemyDamage: 10, mode: 'duo', action: 'attack', deferIncoming: true,
  }), 0);
  assert.equal(incomingDamage({
    enemyDamage: 10, mode: 'solo', action: 'attack', telegraphed: true,
  }), 17);
  assert.equal(incomingDamage({
    enemyDamage: 10, mode: 'solo', action: 'defend', telegraphed: true,
  }), 6);
  assert.equal(incomingDamage({
    enemyDamage: 100, mode: 'solo', action: 'attack', defense: 100,
  }), 74);
});
