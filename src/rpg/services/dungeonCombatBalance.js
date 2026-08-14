function enemyMaxHp(room, mode = 'solo', recommendedLevel = 1) {
  // Tactical encounters must take several deliberate turns.  Bosses previously
  // died in one skill rotation at their recommended level, which made forged
  // equipment and co-op coordination largely cosmetic.
  const roomMultiplier = room.type === 'boss' ? 14 : 5;
  const base = Math.max(8, Number(room.enemy.power) * roomMultiplier);
  const levelScale = 1 + Math.max(0, Number(recommendedLevel) - 10) * 0.025;
  return Math.floor(base * levelScale * (mode === 'duo' ? 1.65 : 1));
}

function combinedPower(actorPower, allyPower = 0, hasAlly = false) {
  return Number(actorPower) + Math.floor(Number(allyPower) * (hasAlly ? 0.3 : 1));
}

// Dungeon panjang menggabungkan banyak serangan musuh dalam satu room. Tanpa
// perlindungan konteks ini, HP/DEF dasar Penyihir dan Assassin membuat keduanya
// jauh tertinggal dari Ksatria, meski damage dan gear mereka setara. Ini hanya
// dipakai pada dungeon solo; raid, hunt, dan combat lain tidak berubah.
function soloClassDamageReduction(className) {
  if (className === 'penyihir') return 0.20;
  if (className === 'pencuri') return 0.20;
  return 0;
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
  defense = 0,
  classDamageReduction = 0,
}) {
  if (defeated || deferIncoming) return 0;
  const incomingScale = mode === 'duo' ? 1.2 : 1;
  const mitigation = mitigationOverride ?? (
    action === 'defend' || defensiveSkill ? 0.35 : action === 'combo' ? 0.5 : 1
  );
  const telegraphScale = telegraphed ? 1.75 : 1;
  // DEF has diminishing returns: it is meaningful for armor upgrades without
  // making high-level tanks invulnerable.  The caller supplies the effective
  // value (base stat + forged equipment bonuses).
  const defenseValue = Math.max(0, Number(defense) || 0);
  const defenseScale = 100 / (100 + defenseValue * 0.35);
  const classScale = 1 - Math.min(0.6, Math.max(0, Number(classDamageReduction) || 0));
  return Math.max(1, Math.floor(
    Number(enemyDamage) * incomingScale * mitigation * telegraphScale * defenseScale * classScale,
  ));
}

module.exports = {
  enemyMaxHp,
  combinedPower,
  soloClassDamageReduction,
  actionMultiplier,
  outgoingDamage,
  incomingDamage,
};
