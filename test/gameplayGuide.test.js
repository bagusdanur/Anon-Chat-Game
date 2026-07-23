const test = require('node:test');
const assert = require('node:assert/strict');
const { determineNextStep } = require('../src/rpg/services/gameplayGuide');

test('progress guide mengikuti objective world dan campaign yang aktif', () => {
  assert.equal(determineNextStep({ hasCharacter: false }).command, '/profile');
  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: false,
  }).key, 'alias');

  const explore = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    activeQuest: {
      title: 'Kabut di Perbatasan',
      objective: { type: 'explore', current: 1, target: 3 },
    },
    nextQuestTitle: 'Jantung Reruntuhan',
  });
  assert.equal(explore.command, '/explore');
  assert.match(explore.detail, /1\/3/);
  assert.match(explore.unlock, /Jantung Reruntuhan/);

  const prepare = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    level: 4,
    hasParty: false,
    activeQuest: {
      title: 'Jantung Reruntuhan',
      objective: { type: 'dungeon_complete', current: 0, target: 1 },
    },
  });
  assert.equal(prepare.key, 'prepare');
  assert.equal(prepare.command, '/hunt');

  const duo = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    level: 4,
    hasParty: true,
    activeQuest: {
      title: 'Jantung Reruntuhan',
      objective: { type: 'dungeon_complete', current: 0, target: 1 },
    },
  });
  assert.equal(duo.command, '/dungeon duo 1');

  const resume = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    activeDungeon: { name: 'Reruntuhan Goblin', roomName: 'Gerbang Elite' },
  });
  assert.equal(resume.command, '/dungeon');
  assert.match(resume.detail, /Gerbang Elite/);

  assert.equal(determineNextStep({
    hasCharacter: true, hasAlias: true, activeQuest: null,
  }).key, 'endgame');
});
