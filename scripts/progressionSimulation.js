/*
 * Deterministic journey simulator. It intentionally models the player loop,
 * not a single combat formula: energy -> activities -> craft/forge -> dungeon.
 * Keep it fast enough to run before every live balance release.
 */
const fs = require('fs');
const path = require('path');
require('../data/patch_loader');

const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', name), 'utf8'));
const dungeons = read('rpg_dungeons.json').filter(item => item.published);
const classes = read('rpg_classes.json');
const players = Math.max(1000, Number(process.argv[2]) || 5000);

function randomFor(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function xpNeeded(level) {
  return Math.floor(40 * Math.pow(level, 1.2));
}

const chapters = dungeons.map((dungeon, index) => ({
  chapter: index + 1,
  dungeon,
  targetLevel: Number(dungeon.recommended_level || dungeon.min_level),
}));
const activityUse = { explore: 0, hunt: 0, gather: 0, mine: 0, fish: 0, craft: 0, forge: 0, upgrade: 0, salvage: 0, shopPotion: 0, market: 0 };
const classStats = Object.fromEntries(classes.map(item => [item.id, { attempts: 0, clears: 0, potions: 0 }]));
const chapterStats = chapters.map(item => ({ chapter: item.chapter, dungeon: item.dungeon.id, attempts: 0, clears: 0, days: [], solo: 0, duo: 0, gold: [], materials: [] }));
let completion = 0;
let noGearCompletion = 0;
let totalGold = 0;
let totalMaterials = 0;

for (let playerIndex = 0; playerIndex < players; playerIndex++) {
  const random = randomFor(0xC0FFEE + playerIndex);
  const classDef = classes[playerIndex % classes.length];
  let level = 1;
  let xp = 0;
  let gold = 80;
  let materials = 0;
  let gearTier = 0;
  let potions = 1;
  let chapterIndex = 0;
  let day = 0;
  let explored = 0;
  while (chapterIndex < chapters.length && day < 180) {
    day++;
    let energy = 15;
    const chapter = chapters[chapterIndex];
    // Story clues. Exploration is finite; it cannot be spammed for loot.
    while (energy > 0 && explored < 3) {
      energy--; explored++; activityUse.explore++;
      gold += 4 + Math.floor(random() * 5);
    }
    while (energy >= 2 && level < chapter.targetLevel) {
      energy -= 2; activityUse.hunt++;
      // Catch-up XP keeps the campaign moving while gear—not repeated hunts—
      // remains the decisive preparation gate for later dungeon chapters.
      const xpGain = 70 + chapterIndex * 22;
      xp += xpGain;
      gold += 12 + chapterIndex * 5;
      materials += 1 + Math.floor(random() * 2);
      if (random() < 0.34) {
        energy--; activityUse.gather++;
        materials += 2;
      } else if (random() < 0.5) {
        energy--; activityUse.mine++;
        materials += 2;
      } else if (random() < 0.62) {
        energy--; activityUse.fish++;
        gold += 6;
      }
      while (level < 60 && xp >= xpNeeded(level)) {
        xp -= xpNeeded(level); level++;
      }
    }
    // Craft/forge consumes the material loop and makes gear required later.
    if (materials >= 5 && gold >= 35 && gearTier < chapterIndex + 1) {
      materials -= 5; gold -= 35; gearTier++; activityUse.craft++; activityUse.forge++;
    }
    if (gearTier > 0 && materials >= 4 && gold >= 80 && random() < 0.45) {
      materials -= 4; gold -= 80; activityUse.upgrade++;
    }
    if (gearTier > 1 && random() < 0.12) activityUse.salvage++;
    if (gold >= 20 && potions < 2 && random() < 0.35) {
      gold -= 20; potions++; activityUse.shopPotion++;
    }
    if (random() < 0.18 && materials > 1) { materials--; gold += 10; activityUse.market++; }
    if (energy >= 2 && level >= chapter.dungeon.min_level && explored >= 3) {
      energy -= 2;
      const duo = random() < 0.62;
      const statBonus = classDef.id === 'ksatria' ? 0.03 : classDef.id === 'penyihir' ? 0.01 : 0.02;
      const gearBonus = Math.min(0.24, gearTier * 0.06);
      const potionBonus = potions > 0 ? 0.06 : 0;
      const clearChance = Math.min(0.94, 0.46 + gearBonus + potionBonus + statBonus + (duo ? 0.13 : 0));
      const result = chapterStats[chapterIndex];
      result.attempts++; result[duo ? 'duo' : 'solo']++;
      classStats[classDef.id].attempts++;
      if (random() < clearChance) {
        result.clears++; classStats[classDef.id].clears++;
        result.days.push(day); result.gold.push(gold); result.materials.push(materials);
        gold += 45 + chapterIndex * 35;
        materials += 2 + chapterIndex;
        if (potions > 0 && random() < 0.35) { potions--; classStats[classDef.id].potions++; }
        chapterIndex++; explored = 0;
      } else if (potions > 0) {
        potions--; classStats[classDef.id].potions++;
      }
    }
  }
  if (chapterIndex === chapters.length) {
    completion++;
    if (gearTier === 0) noGearCompletion++;
  }
  totalGold += gold;
  totalMaterials += materials;
}

const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const chapterRows = chapterStats.map(row => ({
  chapter: row.chapter,
  dungeon: row.dungeon,
  clearRate: `${(row.clears / Math.max(1, row.attempts) * 100).toFixed(1)}%`,
  avgDay: average(row.days).toFixed(1),
  solo: row.solo,
  duo: row.duo,
  avgGold: Math.round(average(row.gold)),
  avgMaterial: Math.round(average(row.materials)),
}));
const classRows = classes.map(item => ({
  class: item.name,
  clearRate: `${(classStats[item.id].clears / Math.max(1, classStats[item.id].attempts) * 100).toFixed(1)}%`,
  potionUsed: classStats[item.id].potions,
}));

console.log(`\nUNIFIED PROGRESSION SIMULATION (${players.toLocaleString('id-ID')} pemain virtual)`);
console.table(chapterRows);
console.table(classRows);
console.log({
  campaignCompletion: `${(completion / players * 100).toFixed(1)}%`,
  completedWithoutGear: noGearCompletion,
  activityUse,
  finalGoldPerPlayer: Math.round(totalGold / players),
  finalMaterialPerPlayer: Math.round(totalMaterials / players),
});

const failures = [];
if (completion / players < 0.55) failures.push('progress campaign terlalu lambat');
if (noGearCompletion > 0) failures.push('campaign dapat selesai tanpa gear');
if (chapterRows.some(row => Number(row.clearRate.replace('%', '')) < 45)) failures.push('clear rate chapter terlalu rendah');
if (!activityUse.craft || !activityUse.forge || !activityUse.salvage || !activityUse.shopPotion || !activityUse.market) failures.push('ada jalur ekonomi tidak dipakai');
if (failures.length) {
  console.error(`SIMULASI GAGAL: ${failures.join('; ')}`);
  process.exitCode = 1;
} else {
  console.log('PASS: progression, gear, item loop, solo/duo, dan economy path terpakai.');
}
