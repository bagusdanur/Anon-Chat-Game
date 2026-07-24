const test = require('node:test');
const assert = require('node:assert/strict');
const { determineNextStep, getCompletedChecklist } = require('../src/rpg/services/gameplayGuide');
const { renderGuide } = require('../src/rpg/guide');
const { getOrCreateUser, createUser } = require('../src/rpg/db_rpg');

test('getCompletedChecklist returns correct milestone checklist', () => {
  const stateNew = { hasCharacter: false };
  const checklistNew = getCompletedChecklist(stateNew);
  assert.equal(checklistNew[0].done, false);
  assert.equal(checklistNew[1].done, false);

  const stateRegistered = {
    hasCharacter: true,
    hasAlias: true,
    explorationPoints: 10,
    level: 3,
    chapter: 1,
    hasParty: false,
  };
  const checklistRegistered = getCompletedChecklist(stateRegistered);
  assert.equal(checklistRegistered[0].done, true);
  assert.equal(checklistRegistered[1].done, true);
  assert.equal(checklistRegistered[2].done, true);
  assert.equal(checklistRegistered[3].done, true);
  assert.equal(checklistRegistered[4].done, false);
});
