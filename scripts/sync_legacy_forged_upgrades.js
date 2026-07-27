const { db } = require('../src/db');

const now = Math.floor(Date.now() / 1000);
const candidates = db.prepare(`
  SELECT e.id,e.upgrade_tier AS forged_tier,i.upgrade_tier AS legacy_tier
  FROM rpg_equipment_instances e
  JOIN rpg_inventory i
    ON i.telegram_user_id=e.owner_id AND i.item_id=e.item_id
  WHERE e.equipped_slot IS NOT NULL AND i.upgrade_tier>e.upgrade_tier
`).all();

const result = db.transaction(() => {
  let synchronized = 0;
  for (const item of candidates) {
    const tierGain = item.legacy_tier - item.forged_tier;
    const updated = db.prepare(`
      UPDATE rpg_equipment_instances
      SET upgrade_tier=?,item_power=item_power+?,updated_at=?
      WHERE id=? AND upgrade_tier=?
    `).run(item.legacy_tier, tierGain * 3, now, item.id, item.forged_tier);
    synchronized += updated.changes;
  }
  return { candidates: candidates.length, synchronized };
})();

console.log(JSON.stringify(result));
db.close();
