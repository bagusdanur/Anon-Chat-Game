const items = {
  potion_small: { name: '🧪 Ramuan Kecil', effect: 'Heal 10 HP' },
  scroll_power: { name: '📜 Gulungan Kekuatan', effect: '+3 ATK' },
  amulet_revive: { name: '💠 Jimat Kebangkitan', effect: 'Auto Revive 50%' }
};

function rollLoot(enemyId) {
  // Amulet specific to rats
  if (enemyId === 'tikus_raksasa' && Math.random() <= 0.15) {
    return 'amulet_revive';
  }
  
  // Normal drops
  const rand = Math.random();
  if (rand <= 0.35) {
    return 'potion_small';
  } else if (rand <= 0.55) {
    return 'scroll_power'; // 20% chance (0.55 - 0.35)
  }
  
  return null;
}

module.exports = { items, rollLoot };
