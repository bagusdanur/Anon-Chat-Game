function clampChance(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

function effectiveDropChance(baseChance, multiplier = 1) {
  return clampChance(Number(baseChance) * Math.max(0, Number(multiplier) || 0));
}

function rollDrop(baseChance, multiplier = 1, random = Math.random) {
  return random() < effectiveDropChance(baseChance, multiplier);
}

module.exports = { clampChance, effectiveDropChance, rollDrop };
