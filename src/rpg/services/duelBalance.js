// PvP memakai layer sendiri karena damage PvE dibangun untuk mengalahkan boss
// ber-HP besar. Semua angka di sini hanya dipakai oleh /duel.
const ARENA_HP_MULTIPLIER = 0.85;
const PVP_DAMAGE_MULTIPLIER = 0.55;
const PVP_CRIT_RATE_CAP = 0.25;
const PVP_CRIT_MULTIPLIER_CAP = 1.6;
const PVP_MAX_HIT_PERCENT = 0.45;
const MAX_DUEL_LEVEL_GAP = 10;
const MAX_BURN_PERCENT_PER_TURN = 0.06;

function arenaHp(maxHp, bonusHp = 0) {
  return Math.max(1, Math.floor((Number(maxHp) + (Number(bonusHp) || 0)) * ARENA_HP_MULTIPLIER));
}

function pvpCritRate(value) {
  return Math.min(PVP_CRIT_RATE_CAP, Math.max(0, Number(value) || 0));
}

function pvpCritMultiplier(value) {
  return Math.min(PVP_CRIT_MULTIPLIER_CAP, Math.max(1, Number(value) || 1.5));
}

function pvpDamage(value, defenderMaxHp = 0) {
  const scaled = Math.max(1, Math.floor(Math.max(0, Number(value) || 0) * PVP_DAMAGE_MULTIPLIER));
  const hitCap = Math.floor(Math.max(0, Number(defenderMaxHp) || 0) * PVP_MAX_HIT_PERCENT);
  return hitCap > 0 ? Math.min(scaled, Math.max(1, hitCap)) : scaled;
}

function pvpBurnDamage(value, defenderMaxHp) {
  return Math.min(
    Math.max(1, Math.floor(Number(defenderMaxHp) * MAX_BURN_PERCENT_PER_TURN)),
    pvpDamage(value),
  );
}

function canDuel(left, right) {
  const gap = Math.abs(Number(left?.level || 1) - Number(right?.level || 1));
  if (gap > MAX_DUEL_LEVEL_GAP) {
    return { success: false, reason: `Selisih level terlalu jauh (${gap}). Batas duel arena adalah ${MAX_DUEL_LEVEL_GAP} level.` };
  }
  return { success: true };
}

module.exports = {
  ARENA_HP_MULTIPLIER,
  PVP_DAMAGE_MULTIPLIER,
  PVP_CRIT_RATE_CAP,
  PVP_CRIT_MULTIPLIER_CAP,
  PVP_MAX_HIT_PERCENT,
  MAX_DUEL_LEVEL_GAP,
  MAX_BURN_PERCENT_PER_TURN,
  arenaHp,
  pvpCritRate,
  pvpCritMultiplier,
  pvpDamage,
  pvpBurnDamage,
  canDuel,
};
