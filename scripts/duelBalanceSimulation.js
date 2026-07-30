const classes = require('../data/rpg_classes.json');
const {
  arenaHp,
  pvpDamage,
  pvpCritMultiplier,
} = require('../src/rpg/services/duelBalance');

function stats(classDef, level) {
  return {
    hp: Math.floor(classDef.base_hp + classDef.growth.hp * (level - 1)),
    atk: classDef.base_atk + classDef.growth.atk * (level - 1),
    def: classDef.base_def + classDef.growth.def * (level - 1),
    magic: classDef.base_magic_atk + classDef.growth.magic_atk * (level - 1),
  };
}

function highestSkill(classDef) {
  if (classDef.id === 'ksatria') return { multiplier: 4, physical: true, crit: false };
  if (classDef.id === 'penyihir') return { multiplier: 3.2, physical: false, crit: false };
  return { multiplier: 2.8, physical: true, crit: false };
}

function skillDamage(attacker, defender) {
  const skill = highestSkill(attacker.classDef);
  const base = skill.physical ? attacker.stats.atk + 32 : attacker.stats.magic + 32;
  const classBonus = skill.physical ? attacker.classDef.physBonus : attacker.classDef.magicBonus;
  const defense = skill.physical ? defender.stats.def + 32 : Math.floor((defender.stats.def + 32) / 3);
  const raw = Math.max(1, Math.floor(base * skill.multiplier * classBonus) - defense);
  return pvpDamage(
    raw * (skill.crit ? pvpCritMultiplier(attacker.classDef.base_crit_multi) : 1),
    arenaHp(defender.stats.hp, 42),
  );
}

const level = 60;
const fighters = classes.map(classDef => ({ classDef, stats: stats(classDef, level) }));
const rows = [];
for (const attacker of fighters) {
  for (const defender of fighters) {
    if (attacker === defender) continue;
    const hp = arenaHp(defender.stats.hp, 42);
    const damage = skillDamage(attacker, defender);
    rows.push({
      attacker: attacker.classDef.id,
      defender: defender.classDef.id,
      arenaHp: hp,
      strongestSkillDamage: damage,
      hpPercent: `${Math.round(damage / hp * 100)}%`,
    });
    if (damage >= hp) throw new Error(`${attacker.classDef.id} masih one-hit ${defender.classDef.id}.`);
  }
}
console.table(rows);
console.log('PASS: strongest PvP skill dengan gear matang wajar tidak one-hit lawan setara.');
