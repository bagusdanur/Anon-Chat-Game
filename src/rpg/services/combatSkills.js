function rankedValue(value, rank, fallback = 0) {
  if (Array.isArray(value)) {
    return value[Math.min(Math.max(rank - 1, 0), value.length - 1)] ?? fallback;
  }
  return value ?? fallback;
}

function tickSkillCooldowns(player) {
  player.skillCooldowns = player.skillCooldowns || {};
  for (const skillId of Object.keys(player.skillCooldowns)) {
    player.skillCooldowns[skillId] = Math.max(0, player.skillCooldowns[skillId] - 1);
  }
}

function getSkillCooldown(player, skillId) {
  return Math.max(0, player.skillCooldowns?.[skillId] || 0);
}

function setSkillCooldown(player, skill) {
  player.skillCooldowns = player.skillCooldowns || {};
  player.skillCooldowns[skill.id] = Number(skill.effect?.cooldown) || 0;
}

function findLoadoutSkill(player, skillId) {
  return (player.skillLoadout || []).find(skill => skill.id === skillId) || null;
}

function resolveCombatSkill(options) {
  const {
    attacker,
    defender,
    skill,
    calcPhysicalDamage,
    calcMagicDamage,
    rollCrit,
  } = options;
  const effect = skill.effect || {};
  const rank = skill.rank || 1;
  const result = { damage: 0, heal: 0, log: '', status: null };
  const physicalBase = attacker.atk + (attacker.atkBonus || 0);
  const magicBase = attacker.magicAtk || attacker.atk;

  if (effect.type === 'physical_damage') {
    const multiplier = rankedValue(effect.multiplier, rank, 1);
    result.damage = calcPhysicalDamage(
      attacker,
      defender,
      physicalBase,
      multiplier,
      effect.armor_penetration || 0,
    );
    const crit = effect.guaranteed_crit
      ? { isCrit: true, multiplier: attacker.critMulti || 1.5 }
      : rollCrit(attacker.critRate || 0.05, attacker.critMulti || 1.5);
    result.damage = Math.floor(result.damage * crit.multiplier);
    result.log = `${skill.name}! -${result.damage} HP${crit.isCrit ? ' 💥 CRIT!' : ''}`;
  } else if (effect.type === 'magic_damage') {
    const multiplier = rankedValue(effect.multiplier, rank, 1);
    result.damage = calcMagicDamage(attacker, defender, magicBase, multiplier);
    const crit = rollCrit(attacker.critRate || 0.05, attacker.critMulti || 1.5);
    result.damage = Math.floor(result.damage * crit.multiplier);
    if (effect.status === 'burn') {
      result.status = {
        type: 'burn',
        turns: 3,
        power: Math.max(1, Math.floor(result.damage * 0.1)),
      };
    }
    result.log = `${skill.name}! -${result.damage} HP${result.status ? ' + 🔥 Burn' : ''}${crit.isCrit ? ' 💥 CRIT!' : ''}`;
  } else if (effect.type === 'guard') {
    attacker.defending = true;
    attacker.guardReduction = rankedValue(effect.reduction, rank, 0.35);
    result.log = `${skill.name}! Damage diterima berkurang ${Math.round(attacker.guardReduction * 100)}%.`;
  } else if (effect.type === 'shield') {
    attacker.shieldPercent = rankedValue(effect.power, rank, 0.15);
    result.log = `${skill.name}! Shield ${Math.round(attacker.shieldPercent * 100)}% aktif.`;
  } else if (effect.type === 'provoke') {
    attacker.provoking = true;
    attacker.defending = true;
    attacker.guardReduction = rankedValue(effect.reduction, rank, 0.25);
    result.log = `${skill.name}! Partner dilindungi pada turn ini.`;
  } else if (effect.type === 'weaken') {
    defender.weakenPower = rankedValue(effect.power, rank, 0.15);
    result.log = `${skill.name}! Damage lawan berkurang ${Math.round(defender.weakenPower * 100)}%.`;
  } else {
    throw new Error(`Unsupported combat skill effect: ${effect.type}`);
  }

  setSkillCooldown(attacker, skill);
  return result;
}

module.exports = {
  rankedValue,
  tickSkillCooldowns,
  getSkillCooldown,
  setSkillCooldown,
  findLoadoutSkill,
  resolveCombatSkill,
};
