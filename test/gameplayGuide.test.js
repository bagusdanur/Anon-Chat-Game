const test = require('node:test');
const assert = require('node:assert/strict');
const { determineNextStep } = require('../src/rpg/services/gameplayGuide');

test('panduan gameplay mengarahkan pemain dari onboarding sampai endgame', () => {
  assert.equal(determineNextStep({ hasCharacter: false }).command, '/profile');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: false,
  }).key, 'alias');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, hasSkill: false,
  }).command, '/skill');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, hasSkill: true, explorationPoints: 1,
  }).command, '/explore');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, hasSkill: true, explorationPoints: 3,
    hasDungeonClear: false, hasParty: false, level: 4,
  }).key, 'prepare');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, hasSkill: true, explorationPoints: 3,
    hasDungeonClear: false, hasParty: true, level: 4,
  }).command, '/dungeon duo 1');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, hasSkill: true, explorationPoints: 3,
    hasDungeonClear: true, hasParty: false, level: 8,
  }).command, '/coop');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, hasSkill: true, explorationPoints: 3,
    hasDungeonClear: true, hasParty: true, level: 8,
  }).key, 'endgame');
});
