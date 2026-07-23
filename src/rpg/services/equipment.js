const fs = require('fs');
const path = require('path');

const CONTENT_FILE = path.join(__dirname, '../../../data/rpg_affixes.json');
const EQUIPMENT_SLOTS = ['weapon', 'staff', 'armor', 'accessory'];
const RARITY_RULES = {
  common: { affixes: 0, sockets: 0, multiplier: 1 },
  uncommon: { affixes: 1, sockets: 0, multiplier: 1.1 },
  rare: { affixes: 1, sockets: 1, multiplier: 1.25 },
  epic: { affixes: 2, sockets: 1, multiplier: 1.5 },
  legendary: { affixes: 3, sockets: 2, multiplier: 1.85 },
};

function loadEquipmentContent(filePath = CONTENT_FILE) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(content.affixes) || !content.gems) throw new Error('Content equipment tidak valid.');
  const ids = new Set();
  for (const affix of content.affixes) {
    if (!affix.id || ids.has(affix.id) || !affix.stat || !Array.isArray(affix.slots)) {
      throw new Error(`Affix tidak valid: ${affix.id}`);
    }
    ids.add(affix.id);
  }
  return content;
}

function createEquipmentService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const random = options.random || Math.random;
  const content = options.content || loadEquipmentContent();

  function getInstance(userId, instanceId) {
    const item = db.prepare(`
      SELECT e.*,c.display_name,c.category FROM rpg_equipment_instances e
      JOIN items_catalog c ON c.item_id=e.item_id
      WHERE e.id=? AND e.owner_id=?
    `).get(Number(instanceId), String(userId));
    if (!item) return null;
    item.affixes = db.prepare('SELECT * FROM rpg_equipment_affixes WHERE instance_id=? ORDER BY affix_id').all(item.id);
    item.sockets = db.prepare('SELECT * FROM rpg_equipment_sockets WHERE instance_id=? ORDER BY socket_index').all(item.id);
    return item;
  }

  function list(userId) {
    return db.prepare(`
      SELECT e.*,c.display_name,c.category FROM rpg_equipment_instances e
      JOIN items_catalog c ON c.item_id=e.item_id
      WHERE e.owner_id=? ORDER BY e.equipped_slot IS NOT NULL DESC,e.item_power DESC,e.id
    `).all(String(userId)).map(item => getInstance(userId, item.id));
  }

  function forge(userId, itemId) {
    const catalog = db.prepare('SELECT * FROM items_catalog WHERE item_id=?').get(String(itemId));
    if (!catalog || !EQUIPMENT_SLOTS.includes(catalog.category)) {
      return { success: false, reason: 'Item itu bukan equipment.' };
    }
    const legacy = db.prepare(`
      SELECT * FROM rpg_inventory WHERE telegram_user_id=? AND item_id=?
    `).get(String(userId), String(itemId));
    if (!legacy || legacy.quantity < 1) return { success: false, reason: 'Equipment legacy tidak ditemukan.' };
    if (legacy.equipped) return { success: false, reason: 'Lepas equipment legacy terlebih dahulu.' };
    const rule = RARITY_RULES[catalog.rarity] || RARITY_RULES.common;
    const quality = 50 + Math.floor(random() * 51);
    const user = db.prepare('SELECT level FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
    const itemPower = Math.max(1, Math.floor((user.level * 10 + quality) * rule.multiplier));
    const pool = content.affixes.filter(affix => affix.slots.includes(catalog.category));
    return db.transaction(() => {
      if (legacy.quantity === 1) {
        db.prepare('DELETE FROM rpg_inventory WHERE id=?').run(legacy.id);
      } else {
        db.prepare('UPDATE rpg_inventory SET quantity=quantity-1 WHERE id=?').run(legacy.id);
      }
      const instanceId = Number(db.prepare(`
        INSERT INTO rpg_equipment_instances
          (owner_id,item_id,rarity,quality,item_power,upgrade_tier,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?)
      `).run(
        String(userId), catalog.item_id, catalog.rarity, quality, itemPower,
        legacy.upgrade_tier || 0, now(), now(),
      ).lastInsertRowid);
      const available = [...pool];
      const affixCount = Math.min(rule.affixes, available.length);
      for (let index = 0; index < affixCount; index++) {
        const pickedIndex = Math.floor(random() * available.length);
        const affix = available.splice(pickedIndex, 1)[0];
        const tier = Math.max(1, Math.min(5, 1 + Math.floor(quality / 21)));
        const value = affix.min + (affix.max - affix.min) * random();
        db.prepare(`
          INSERT INTO rpg_equipment_affixes (instance_id,affix_id,stat_key,stat_value,tier)
          VALUES (?,?,?,?,?)
        `).run(instanceId, affix.id, affix.stat, Number(value.toFixed(3)), tier);
      }
      for (let socket = 1; socket <= rule.sockets; socket++) {
        db.prepare('INSERT INTO rpg_equipment_sockets (instance_id,socket_index) VALUES (?,?)')
          .run(instanceId, socket);
      }
      return { success: true, item: getInstance(userId, instanceId) };
    })();
  }

  function equip(userId, instanceId) {
    const item = getInstance(userId, instanceId);
    if (!item) return { success: false, reason: 'Equipment instance tidak ditemukan.' };
    db.transaction(() => {
      db.prepare('UPDATE rpg_equipment_instances SET equipped_slot=NULL,updated_at=? WHERE owner_id=? AND equipped_slot=?')
        .run(now(), String(userId), item.category);
      db.prepare(`
        UPDATE rpg_equipment_instances SET equipped_slot=?,bind_status='account_bound',updated_at=?
        WHERE id=? AND owner_id=?
      `).run(item.category, now(), item.id, String(userId));
    })();
    return { success: true, item: getInstance(userId, item.id) };
  }

  function socketGem(userId, instanceId, socketIndex, gemItemId) {
    const item = getInstance(userId, instanceId);
    const gem = content.gems[gemItemId];
    if (!item) return { success: false, reason: 'Equipment instance tidak ditemukan.' };
    if (!gem) return { success: false, reason: 'Gem tidak dikenal.' };
    const socket = item.sockets.find(entry => entry.socket_index === Number(socketIndex));
    if (!socket) return { success: false, reason: 'Socket tidak tersedia.' };
    if (socket.gem_item_id) return { success: false, reason: 'Socket sudah terisi.' };
    const inventory = db.prepare(`
      SELECT * FROM rpg_inventory WHERE telegram_user_id=? AND item_id=?
    `).get(String(userId), gemItemId);
    if (!inventory || inventory.quantity < 1) return { success: false, reason: 'Gem tidak ada di inventory.' };
    db.transaction(() => {
      if (inventory.quantity === 1) db.prepare('DELETE FROM rpg_inventory WHERE id=?').run(inventory.id);
      else db.prepare('UPDATE rpg_inventory SET quantity=quantity-1 WHERE id=?').run(inventory.id);
      db.prepare(`
        UPDATE rpg_equipment_sockets SET gem_item_id=?,stat_key=?,stat_value=?
        WHERE instance_id=? AND socket_index=? AND gem_item_id IS NULL
      `).run(gemItemId, gem.stat, gem.value, item.id, Number(socketIndex));
    })();
    return { success: true, item: getInstance(userId, item.id) };
  }

  function bonuses(userId) {
    const rows = db.prepare(`
      SELECT a.stat_key,a.stat_value FROM rpg_equipment_affixes a
      JOIN rpg_equipment_instances e ON e.id=a.instance_id
      WHERE e.owner_id=? AND e.equipped_slot IS NOT NULL
      UNION ALL
      SELECT s.stat_key,s.stat_value FROM rpg_equipment_sockets s
      JOIN rpg_equipment_instances e ON e.id=s.instance_id
      WHERE e.owner_id=? AND e.equipped_slot IS NOT NULL AND s.gem_item_id IS NOT NULL
    `).all(String(userId), String(userId));
    return rows.reduce((total, row) => {
      total[row.stat_key] = (total[row.stat_key] || 0) + row.stat_value;
      return total;
    }, {});
  }

  return { getInstance, list, forge, equip, socketGem, bonuses };
}

module.exports = {
  CONTENT_FILE, EQUIPMENT_SLOTS, RARITY_RULES,
  loadEquipmentContent, createEquipmentService,
};
