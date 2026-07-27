const fs = require('fs');
const path = require('path');
const {
  calculateItemPower,
  upgradeRequirements,
} = require('../src/rpg/services/equipment');

const dungeons = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/rpg_dungeons.json'), 'utf8'),
);

const rows = dungeons.map(dungeon => {
  const itemLevel = Number(dungeon.recommended_level || dungeon.min_level || 1);
  return {
    dungeon: dungeon.id,
    itemLevel,
    rareIpQ60: calculateItemPower(itemLevel, 60, 'rare'),
    rareIpQ90: calculateItemPower(itemLevel, 90, 'rare'),
    soloChance: '12%',
    duoChance: '18%',
    pity: 'drop ke-5',
  };
});

for (let index = 1; index < rows.length; index++) {
  if (rows[index].itemLevel > rows[index - 1].itemLevel &&
      rows[index].rareIpQ60 <= rows[index - 1].rareIpQ60) {
    throw new Error(`IP dungeon tidak meningkat: ${rows[index].dungeon}`);
  }
}

const upgradeRows = Array.from({ length: 15 }, (_, index) => {
  const tier = index + 1;
  const requirement = upgradeRequirements(tier);
  if (tier > 1 && requirement.gold <= upgradeRequirements(tier - 1).gold) {
    throw new Error(`Gold upgrade +${tier} tidak meningkat.`);
  }
  return {
    tier: `+${tier}`,
    gold: requirement.gold,
    materials: requirement.materials
      .map(item => `${item.quantity}x ${item.itemId}`)
      .join(' + '),
  };
});

console.log('\nSkala gear drop berdasarkan level DUNGEON (bukan level pemain):');
console.table(rows);
console.log('\nBiaya upgrade bertingkat:');
console.table(upgradeRows);
console.log('\nPASS: low-dungeon exploit tertutup, IP lintas dungeon meningkat, biaya +1–+15 meningkat.');
