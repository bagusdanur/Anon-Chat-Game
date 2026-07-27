const test = require('node:test');
const assert = require('node:assert/strict');
const {
  determineNextStep,
  getClassBuildAdvice,
  formatObjectiveLabel,
  getSagaHeader,
} = require('../src/rpg/services/gameplayGuide');

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

test('tracker Saga II memakai nomor dungeon dan rekomendasi level dinamis', () => {
  const prepare = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    level: 25,
    hasParty: false,
    activeQuest: {
      title: 'Benteng Kristal Astral',
      objective: {
        type: 'dungeon_complete',
        label: 'Taklukkan Benteng Kristal Astral',
        current: 0,
        target: 1,
        dungeonNumber: 4,
        recommendedLevel: 30,
      },
    },
  });
  assert.equal(prepare.command, '/hunt');
  assert.match(prepare.detail, /Lv\.30/);
  assert.match(prepare.unlock, /dungeon solo 4/);

  const duo = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    level: 30,
    hasParty: true,
    activeQuest: {
      title: 'Benteng Kristal Astral',
      objective: {
        type: 'dungeon_complete',
        current: 0,
        target: 1,
        dungeonNumber: 4,
        recommendedLevel: 30,
      },
    },
  });
  assert.equal(duo.command, '/dungeon duo 4');
});

test('tracker mengenali objective hunt, class Pencuri, dan chapter Saga II', () => {
  const hunt = determineNextStep({
    hasCharacter: true,
    hasAlias: true,
    activeQuest: {
      title: 'Pemburu Astral',
      objective: { type: 'hunt', current: 3, target: 8 },
    },
  });
  assert.equal(hunt.command, '/hunt');
  assert.match(hunt.detail, /3\/8/);
  assert.match(getClassBuildAdvice('Pencuri').className, /Pencuri/);
  assert.equal(formatObjectiveLabel('clear_emperor_throne'), 'Runtuhkan Kaisar Kosmik Xylarion');
  assert.match(getSagaHeader(4), /SAGA II/);
  assert.match(getSagaHeader(7), /Chapter 7/);
});

test('tracker memprioritaskan recovery saat HP kritis sebelum menyuruh hunt lagi', () => {
  const state = {
    hasCharacter: true,
    hasAlias: true,
    level: 2,
    gold: 33,
    hp: 1,
    maxHp: 58,
    energy: 0,
    hasHealingItem: false,
    activeQuest: {
      title: 'Jantung Reruntuhan',
      objective: {
        type: 'dungeon_complete', label: 'Reruntuhan Goblin',
        current: 0, target: 1, recommendedLevel: 7,
      },
    },
  };
  const next = determineNextStep(state);
  assert.equal(next.key, 'recover');
  assert.equal(next.command, '/shop');
  assert.match(next.detail, /1\/58/);
});

test('tracker meminta travel sebelum eksplorasi region campaign berikutnya', () => {
  const next = determineNextStep({
    hasCharacter: true, hasAlias: true, level: 7,
    hp: 98, maxHp: 98, energy: 10,
    currentRegionId: 'aldenmoor_outskirts',
    regionName: 'Pinggiran Aldenmoor',
    activeQuest: {
      title: 'Jejak Jaring Ungu',
      objective: {
        type: 'explore', label: 'Jelajahi Lembah Sutra Beracun',
        targetId: 'spider_lair_valley', targetRegionNumber: 2,
        targetRegionMinLevel: 6, current: 0, target: 4,
      },
    },
  });
  assert.equal(next.key, 'travel');
  assert.equal(next.command, '/travel 2');
});
