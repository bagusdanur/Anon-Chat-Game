const fs = require('fs');
const path = require('path');
const classes = require('../data/rpg_classes.json');
const skills = require('../data/rpg_skills.json');
const {
  enemyMaxHp,
  combinedPower,
  outgoingDamage,
  incomingDamage,
} = require('../src/rpg/services/dungeonCombatBalance');

const dungeons = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/rpg_dungeons.json'), 'utf8'),
);

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function classStats(classDef, level) {
  return {
    hp: Math.floor(classDef.base_hp + classDef.growth.hp * (level - 1)),
    atk: classDef.base_atk + classDef.growth.atk * (level - 1),
    def: classDef.base_def + classDef.growth.def * (level - 1),
    magic: classDef.base_magic_atk + classDef.growth.magic_atk * (level - 1),
    critRate: classDef.base_crit_rate,
    critMultiplier: classDef.base_crit_multi,
  };
}

function strongestSkill(classId, level) {
  return skills
    .filter(skill => skill.class_id === classId && skill.min_level <= level && skill.effect?.multiplier)
    .sort((left, right) => {
      const leftValue = [].concat(left.effect.multiplier).at(-1);
      const rightValue = [].concat(right.effect.multiplier).at(-1);
      return rightValue - leftValue;
    })[0] || null;
}

// These profiles are intentionally built from bonuses that a player can obtain
// through the live forge: a class weapon/staff, armor, and accessory.  They do
// not grant imaginary set effects or impossible affixes, so the simulator is a
// useful promise of the real game rather than a best-case spreadsheet.
function gearProfile(classDef, tier) {
  const primary = classDef.damageType === 'magic' ? 'magic' : 'atk';
  const profile = { name: '', atk: 0, def: 0, magic: 0, hp: 0, critRate: 0 };
  if (tier === 'tanpa_gear') return { ...profile, name: 'Tanpa gear' };
  if (tier === 'gear_wajar') {
    return {
      ...profile,
      name: 'Gear wajar',
      [primary]: 16, // rare +3 weapon/staff, affix, socket, and accessory affix
      def: 18, // epic armor +3, warding affix, and emerald socket
      hp: 18,
      critRate: 0.03,
    };
  }
  return {
    ...profile,
    name: 'Gear matang',
    [primary]: 32, // legendary +8 weapon/staff plus high-quality relevant affixes/gems
    def: 32,
    hp: 42,
    critRate: 0.08,
  };
}

function simulateEncounter({
  room, classDef, level, recommendedLevel, mode, strategy, gearTier, samples, seed,
}) {
  const random = seededRandom(seed);
  const baseStats = classStats(classDef, level);
  const gear = gearProfile(classDef, gearTier);
  const stats = {
    ...baseStats,
    atk: baseStats.atk + gear.atk,
    def: baseStats.def + gear.def,
    magic: baseStats.magic + gear.magic,
    hp: baseStats.hp + gear.hp,
    critRate: Math.min(0.5, baseStats.critRate + gear.critRate),
  };
  const actorPower = stats.atk + stats.def + stats.magic + Math.floor(level * 1.5);
  const partyPower = combinedPower(actorPower, actorPower, mode === 'duo');
  const maxHp = stats.hp * (mode === 'duo' ? 2 : 1);
  const skill = strongestSkill(classDef.id, level);
  const skillMultiplier = skill ? [].concat(skill.effect.multiplier).at(-1) : null;
  const skillCooldown = Number(skill?.effect?.cooldown) || 0;
  let wins = 0;
  let totalTurns = 0;
  let totalDamage = 0;

  for (let sample = 0; sample < samples; sample++) {
    let hp = maxHp;
    let enemyHp = enemyMaxHp(room, mode, recommendedLevel);
    let turn = 0;
    let cooldown = 0;
    let combo = 0;
    let enemyTurns = 0;
    while (hp > 0 && enemyHp > 0 && turn < 100) {
      const actors = mode === 'duo' ? 2 : 1;
      const telegraphNext = (enemyTurns + 1) % 3 === 0;
      for (let actor = 0; actor < actors && hp > 0 && enemyHp > 0; actor++) {
        let action = 'attack';
        let activeSkillMultiplier;
        if (strategy === 'rotation' && telegraphNext) {
          action = 'defend';
        } else if (strategy === 'rotation' && cooldown === 0 && skillMultiplier) {
          action = 'skill';
          activeSkillMultiplier = skillMultiplier;
          cooldown = skillCooldown;
        } else if (strategy === 'rotation' && mode === 'duo' && combo >= 3) {
          action = 'combo';
          combo = 0;
        }
        const critical = skill?.effect?.guaranteed_crit && action === 'skill'
          ? true
          : random() < Math.min(0.5, stats.critRate);
        const dealt = outgoingDamage({
          power: partyPower,
          action,
          random,
          critical,
          critMultiplier: stats.critMultiplier,
          skillMultiplier: activeSkillMultiplier,
        });
        enemyHp = Math.max(0, enemyHp - dealt);
        const received = incomingDamage({
          enemyDamage: room.enemy.damage,
          mode,
          action,
          defeated: enemyHp <= 0,
          deferIncoming: actor < actors - 1,
          telegraphed: telegraphNext,
          mitigationOverride: strategy === 'rotation' && telegraphNext ? 0.25 : undefined,
          defense: stats.def,
        });
        if (enemyHp > 0 && actor === actors - 1) enemyTurns++;
        hp = Math.max(0, hp - received);
        totalDamage += received;
        if (mode === 'duo' && action !== 'combo') combo = Math.min(3, combo + 1);
        if (cooldown > 0 && action !== 'skill') cooldown--;
        turn++;
      }
    }
    if (enemyHp <= 0) wins++;
    totalTurns += turn;
  }
  return {
    winRate: wins / samples,
    turns: totalTurns / samples,
    hpCost: totalDamage / samples / maxHp,
  };
}

const samples = Number(process.argv[2] || 2000);
const rows = [];
for (const dungeon of dungeons) {
  const encounters = dungeon.rooms.filter(room => ['combat', 'boss'].includes(room.type));
  for (const levelKind of ['min', 'recommended']) {
    const level = levelKind === 'min' ? dungeon.min_level : (dungeon.recommended_level || dungeon.min_level);
    for (const mode of ['solo', 'duo']) {
      for (const strategy of ['attack', 'rotation']) {
        for (const gearTier of ['tanpa_gear', 'gear_wajar', 'gear_matang']) {
        const results = [];
        for (const [classIndex, classDef] of classes.entries()) {
          for (const [roomIndex, room] of encounters.entries()) {
            results.push({
              boss: room.type === 'boss',
              ...simulateEncounter({
                room,
                classDef,
                level,
                recommendedLevel: dungeon.recommended_level || dungeon.min_level,
                mode,
                strategy,
                gearTier,
                samples,
                seed: level * 100000 + classIndex * 1000 + roomIndex * 10 + mode.length + strategy.length + gearTier.length,
              }),
            });
          }
        }
        const bossResults = results.filter(result => result.boss);
        const average = (items, key) => items.reduce((sum, item) => sum + item[key], 0) / items.length;
        rows.push({
          dungeon: dungeon.id,
          level: `${levelKind}:${level}`,
          mode,
          strategy,
          gear: gearProfile(classes[0], gearTier).name,
          encounterWin: `${(average(results, 'winRate') * 100).toFixed(1)}%`,
          bossWin: `${(average(bossResults, 'winRate') * 100).toFixed(1)}%`,
          turns: average(results, 'turns').toFixed(1),
          hpCost: `${(average(results, 'hpCost') * 100).toFixed(1)}%`,
        });
        }
      }
    }
  }
}

console.table(rows);

const endgame = rows.filter(row =>
  row.dungeon === 'emperor_throne_citadel' && row.level === 'recommended:55' &&
  row.mode === 'solo' && row.strategy === 'rotation',
);
console.log('\nTarget final boss (solo, tactical rotation):');
console.table(endgame.map(row => ({ gear: row.gear, bossWin: row.bossWin, turns: row.turns, hpCost: row.hpCost })));

const endgameRate = gearName => Number(endgame.find(row => row.gear === gearName)?.bossWin.replace('%', ''));
const bareRate = endgameRate('Tanpa gear');
const normalGearRate = endgameRate('Gear wajar');
const matureGearRate = endgameRate('Gear matang');
if (!(bareRate <= 25 && normalGearRate >= 45 && matureGearRate >= 70 && matureGearRate > normalGearRate)) {
  throw new Error(
    `Balance gear final boss gagal: tanpa=${bareRate}%, wajar=${normalGearRate}%, matang=${matureGearRate}%`,
  );
}
console.log('PASS: gear memengaruhi peluang boss akhir; solo tanpa gear bukan jalur andal.');
