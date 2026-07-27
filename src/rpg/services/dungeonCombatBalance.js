function enemyMaxHp(room, mode = 'solo') {
  const base = Math.max(8, Number(room.enemy.power) * (room.type === 'boss' ? 4 : 3));
  return Math.floor(base * (mode === 'duo' ? 1.8 : 1));
}

function combinedPower(actorPower, allyPower = 0, hasAlly = false) {
  return Number(actorPower) + Math.floor(Number(allyPower) * (hasAlly ? 0.3 : 1));
}

function actionMultiplier({ action, skillMultiplier, defensiveSkill = false }) {
  if (action === 'combo') return 1.1;
  if (action === 'skill') return defensiveSkill ? 0.2 : (Number(skillMultiplier) || 0.8);
  if (action === 'defend') return 0.25;
  return 0.5;
}

function outgoingDamage({
  power,
  action,
  random = Math.random,
  critical = false,
  critMultiplier = 1.5,
  skillMultiplier,
  defensiveSkill = false,
}) {
  const multiplier = actionMultiplier({ action, skillMultiplier, defensiveSkill });
  let damage = Math.max(1, Math.floor(Number(power) * multiplier * (0.9 + random() * 0.2)));
  if (critical) damage = Math.max(1, Math.floor(damage * (Number(critMultiplier) || 1.5)));
  return damage;
}

function incomingDamage({ enemyDamage, mode = 'solo', action, defensiveSkill = false, defeated = false }) {
  if (defeated) return 0;
  const incomingScale = mode === 'duo' ? 1.2 : 1;
  const mitigation = action === 'defend' || defensiveSkill ? 0.35 : action === 'combo' ? 0.5 : 1;
  return Math.max(1, Math.floor(Number(enemyDamage) * incomingScale * mitigation));
}

module.exports = {
  enemyMaxHp,
  combinedPower,
  actionMultiplier,
  outgoingDamage,
  incomingDamage,
};
