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

function simulateEncounter({ room, classDef, level, mode, strategy, samples, seed }) {
  const random = seededRandom(seed);
  const stats = classStats(classDef, level);
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
    let enemyHp = enemyMaxHp(room, mode);
    let turn = 0;
    let cooldown = 0;
    let combo = 0;
    while (hp > 0 && enemyHp > 0 && turn < 100) {
      const actors = mode === 'duo' ? 2 : 1;
      for (let actor = 0; actor < actors && hp > 0 && enemyHp > 0; actor++) {
        let action = 'attack';
        let activeSkillMultiplier;
        if (strategy === 'rotation' && cooldown === 0 && skillMultiplier) {
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
        });
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
        const results = [];
        for (const [classIndex, classDef] of classes.entries()) {
          for (const [roomIndex, room] of encounters.entries()) {
            results.push({
              boss: room.type === 'boss',
              ...simulateEncounter({
                room,
                classDef,
                level,
                mode,
                strategy,
                samples,
                seed: level * 100000 + classIndex * 1000 + roomIndex * 10 + mode.length + strategy.length,
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
          encounterWin: `${(average(results, 'winRate') * 100).toFixed(1)}%`,
          bossWin: `${(average(bossResults, 'winRate') * 100).toFixed(1)}%`,
          turns: average(results, 'turns').toFixed(1),
          hpCost: `${(average(results, 'hpCost') * 100).toFixed(1)}%`,
        });
      }
    }
  }
}

console.table(rows);

