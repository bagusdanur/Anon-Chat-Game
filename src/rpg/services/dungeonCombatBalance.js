function enemyMaxHp(room, mode = 'solo', recommendedLevel = 1) {
  const base = Math.max(8, Number(room.enemy.power) * (room.type === 'boss' ? 6 : 4));
  const levelScale = 1 + Math.max(0, Number(recommendedLevel) - 10) * 0.025;
  return Math.floor(base * levelScale * (mode === 'duo' ? 1.65 : 1));
}

function combinedPower(actorPower, allyPower = 0, hasAlly = false) {
  return Number(actorPower) + Math.floor(Number(allyPower) * (hasAlly ? 0.3 : 1));
}

function actionMultiplier({ action, skillMultiplier, defensiveSkill = false }) {
  if (action === 'combo') return 1.1;
  if (action === 'skill') {
    if (defensiveSkill) return 0.2;
    const configured = Number(skillMultiplier);
    return configured > 0 ? 0.45 + configured * 0.25 : 0.8;
  }
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

function incomingDamage({
  enemyDamage,
  mode = 'solo',
  action,
  defensiveSkill = false,
  defeated = false,
  deferIncoming = false,
  telegraphed = false,
  mitigationOverride,
}) {
  if (defeated || deferIncoming) return 0;
  const incomingScale = mode === 'duo' ? 1.2 : 1;
  const mitigation = mitigationOverride ?? (
    action === 'defend' || defensiveSkill ? 0.35 : action === 'combo' ? 0.5 : 1
  );
  const telegraphScale = telegraphed ? 1.75 : 1;
  return Math.max(1, Math.floor(Number(enemyDamage) * incomingScale * mitigation * telegraphScale));
}

module.exports = {
  enemyMaxHp,
  combinedPower,
  actionMultiplier,
  outgoingDamage,
  incomingDamage,
};
