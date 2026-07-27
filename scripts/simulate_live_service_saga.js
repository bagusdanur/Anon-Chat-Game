/**
 * Deterministic live-service journey simulation for Saga I-II (Chapter 1-7).
 * Content is loaded exclusively through the modular patch aggregator.
 */
const fs = require('fs');
const path = require('path');
const { simulateEconomy } = require('../src/rpg/services/economySimulation');

require('../data/patch_loader');

const readJson = file => JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', file), 'utf8'),
);
const regions = readJson('rpg_regions.json');
const campaigns = readJson('rpg_campaign.json');
const dungeons = readJson('rpg_dungeons.json');
const players = Number(process.argv[2] || 10000);

function seededRandom(seed = 0xA1DE4) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const random = seededRandom();
const chapters = [
  { chapter: 1, patch: '1.0', level: 7, dungeon: 'goblin_ruins', baseWin: 0.84 },
  { chapter: 2, patch: '1.1', level: 15, dungeon: 'spider_nest', baseWin: 0.78 },
  { chapter: 3, patch: '1.2', level: 25, dungeon: 'volcano_fortress', baseWin: 0.72 },
  { chapter: 4, patch: '2.0', level: 30, dungeon: null, baseWin: 0.86 },
  { chapter: 5, patch: '2.1', level: 35, dungeon: 'astral_citadel', baseWin: 0.69 },
  { chapter: 6, patch: '2.2', level: 45, dungeon: 'antimatter_spire', baseWin: 0.64 },
  { chapter: 7, patch: '2.3', level: 60, dungeon: 'emperor_throne_citadel', baseWin: 0.57 },
];

const requiredRegions = [
  'aldenmoor_outskirts',
  'spider_lair_valley',
  'shadow_volcano',
  'ethereal_isles',
  'eclipse_sanctuary',
  'celestial_void_throne',
];
const missing = [
  ...requiredRegions.filter(id => !regions.some(region => region.id === id)),
  ...chapters.filter(item => !campaigns.some(quest => Number(quest.chapter) === item.chapter))
    .map(item => `chapter:${item.chapter}`),
  ...chapters.filter(item => item.dungeon && !dungeons.some(dungeon => dungeon.id === item.dungeon))
    .map(item => item.dungeon),
];
if (missing.length) {
  console.error(`Missing published Saga content: ${missing.join(', ')}`);
  process.exit(1);
}

const stats = Object.fromEntries(chapters.map(item => [
  item.chapter,
  { attempts: 0, clears: 0, solo: 0, duo: 0 },
]));
const actions = {
  combat: 0,
  exploration: 0,
  profession: 0,
  economy: 0,
  gear: 0,
  coop: 0,
};
let goldSources = 0;
let goldSinks = 0;

for (let playerIndex = 0; playerIndex < players; playerIndex++) {
  let active = true;
  let gearTier = 1;
  for (const chapter of chapters) {
    if (!active) break;
    const duo = random() < 0.62;
    stats[chapter.chapter].attempts++;
    stats[chapter.chapter][duo ? 'duo' : 'solo']++;

    actions.exploration += 5;
    actions.profession += chapter.chapter >= 2 ? 3 : 1;
    actions.economy += chapter.chapter >= 2 ? 1 : 0;
    actions.gear++;
    actions.coop += duo ? 2 : 0;
    actions.combat += chapter.dungeon ? 2 : 1;

    const upgradeCost = 35 + chapter.chapter * 30;
    goldSinks += upgradeCost;
    gearTier++;
    const preparationBonus = Math.min(0.14, gearTier * 0.018);
    const coopBonus = duo ? 0.10 : 0;
    const clearChance = Math.min(0.95, chapter.baseWin + preparationBonus + coopBonus);
    if (random() < clearChance) {
      stats[chapter.chapter].clears++;
      goldSources += 75 + chapter.chapter * 70;
    } else {
      active = false;
    }
  }
}

const totalActions = Object.values(actions).reduce((sum, value) => sum + value, 0);
const combatRatio = actions.combat / totalActions;
// Jalur cerita memakai hadiah contoh di atas; kesehatan ekonomi global harus
// dinilai dengan model source/sink yang sama dengan laporan operasi.
const economyModel = simulateEconomy({
  playerCount: Math.max(1000, Math.floor(players / 2)),
  days: 70,
  random: seededRandom(0xEC0A0A),
});
const sourceSinkRatio = economyModel.sourceSinkRatio;

console.log(`\nSAGA I-II JOURNEY SIMULATION (${players.toLocaleString('id-ID')} PLAYERS)`);
console.log('='.repeat(78));
console.table(chapters.map(item => {
  const result = stats[item.chapter];
  return {
    chapter: item.chapter,
    patch: item.patch,
    targetLevel: item.level,
    dungeon: item.dungeon || 'Astral Hunt',
    attempts: result.attempts,
    clears: result.clears,
    clearRate: `${(result.clears / Math.max(1, result.attempts) * 100).toFixed(1)}%`,
    duoRate: `${(result.duo / Math.max(1, result.attempts) * 100).toFixed(1)}%`,
  };
}));
console.log({
  content: {
    regions: regions.length,
    quests: campaigns.length,
    dungeons: dungeons.length,
    chapters: chapters.length,
  },
  diversity: {
    combatRatio: `${(combatRatio * 100).toFixed(1)}%`,
    nonCombatRatio: `${((1 - combatRatio) * 100).toFixed(1)}%`,
  },
  economy: {
    sources: economyModel.sources,
    sinks: economyModel.sinks,
    sourceSinkRatio,
    goldPerPlayer: economyModel.goldPerPlayer,
    sinkBreakdown: economyModel.sinkBreakdown,
  },
});

const failures = [];
if (combatRatio >= 0.15) failures.push(`combat ratio ${(combatRatio * 100).toFixed(1)}% >= 15%`);
if (stats[7].attempts === 0) failures.push('no player reached Chapter 7 simulation');
if (sourceSinkRatio < 1.05 || sourceSinkRatio > 1.25) {
  failures.push(`source/sink ratio ${sourceSinkRatio.toFixed(3)} outside 1.05-1.25`);
}
if (failures.length) {
  console.error(`SIMULATION FAILED: ${failures.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('SAGA I-II CHAPTER 1-7 CONTENT, DIVERSITY, AND ECONOMY CHECK PASSED.');
}
