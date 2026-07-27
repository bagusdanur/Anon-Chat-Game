const fs = require('fs');
const path = require('path');
const { createLedgerService } = require('./ledger');

const CONTENT_FILE = path.join(__dirname, '../../../data/rpg_affixes.json');
const EQUIPMENT_SLOTS = ['weapon', 'staff', 'armor', 'accessory'];
const RARITY_RULES = {
  common: { affixes: 0, sockets: 0, multiplier: 1 },
  uncommon: { affixes: 1, sockets: 0, multiplier: 1.1 },
  rare: { affixes: 1, sockets: 1, multiplier: 1.25 },
  epic: { affixes: 2, sockets: 1, multiplier: 1.5 },
  legendary: { affixes: 3, sockets: 2, multiplier: 1.85 },
};

function calculateItemPower(level, quality, rarity, upgradeTier = 0) {
  const rule = RARITY_RULES[rarity] || RARITY_RULES.common;
  const base = Number(level) * 3 + Math.round(Number(quality) / 10);
  return Math.max(1, Math.floor(base * rule.multiplier) + Number(upgradeTier) * 3);
}

function upgradeRequirements(tier) {
  const rules = {
    1: [['tembaga', 2]], 2: [['tembaga', 3]], 3: [['tembaga', 4]],
    4: [['besi_rongsok', 3]], 5: [['besi_rongsok', 5]],
    6: [['perak', 2]], 7: [['perak', 3]], 8: [['perak', 4]],
    9: [['obsidian_murni', 3]], 10: [['obsidian_murni', 5]],
    11: [['emas_ore', 3]], 12: [['kristal_nexus', 3]],
    13: [['air_mata_gerhana', 3]],
    14: [['air_mata_gerhana', 4], ['inti_antimateri', 1]],
    15: [['inti_supernova', 1], ['inti_antimateri', 2]],
  };
  return {
    gold: 100 + (90 * tier) + (25 * tier * tier),
    materials: (rules[tier] || []).map(([itemId, quantity]) => ({ itemId, quantity })),
  };
}

function loadEquipmentContent(filePath = CONTENT_FILE) {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(content.affixes) || !content.gems || !Array.isArray(content.sets)) {
    throw new Error('Content equipment tidak valid.');
  }
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
  const ledger = createLedgerService(db);

  function setForItem(itemId) {
    return content.sets.find(set => set.items.includes(itemId)) || null;
  }

  function rollAffixes(instanceId, category, count, quality, className = null) {
    const available = content.affixes.filter(affix => {
      if (!affix.slots.includes(category)) return false;
      if (['ksatria', 'pencuri'].includes(className) && affix.stat === 'magic_atk') return false;
      if (className === 'penyihir' && affix.stat === 'atk') return false;
      return true;
    });
    const affixCount = Math.min(count, available.length);
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
  }

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

  function forge(userId, itemId, forgeOptions = {}) {
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
    const qualityMin = Math.max(1, Number(forgeOptions.qualityMin || 50));
    const qualityMax = Math.max(qualityMin, Number(forgeOptions.qualityMax || 100));
    const quality = qualityMin + Math.floor(random() * (qualityMax - qualityMin + 1));
    const user = db.prepare('SELECT level,class_name FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
    const itemLevel = Math.max(1, Number(forgeOptions.itemLevel || user.level));
    const itemPower = calculateItemPower(itemLevel, quality, catalog.rarity, legacy.upgrade_tier || 0);
    const pool = content.affixes.filter(affix => affix.slots.includes(catalog.category));
    return db.transaction(() => {
      if (legacy.quantity === 1) {
        db.prepare('DELETE FROM rpg_inventory WHERE id=?').run(legacy.id);
      } else {
        db.prepare('UPDATE rpg_inventory SET quantity=quantity-1 WHERE id=?').run(legacy.id);
      }
      const set = setForItem(catalog.item_id);
      const instanceId = Number(db.prepare(`
        INSERT INTO rpg_equipment_instances
          (owner_id,item_id,rarity,quality,item_power,upgrade_tier,set_id,item_level,source_dungeon_id,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `).run(
        String(userId), catalog.item_id, catalog.rarity, quality, itemPower,
        legacy.upgrade_tier || 0, set?.id || null, itemLevel,
        forgeOptions.sourceDungeonId || null, now(), now(),
      ).lastInsertRowid);
      rollAffixes(instanceId, catalog.category, Math.min(rule.affixes, pool.length), quality, user.class_name);
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
    const total = rows.reduce((result, row) => {
      result[row.stat_key] = (result[row.stat_key] || 0) + row.stat_value;
      return result;
    }, {});
    const upgraded = db.prepare(`
      SELECT c.category,e.upgrade_tier
      FROM rpg_equipment_instances e
      JOIN items_catalog c ON c.item_id=e.item_id
      WHERE e.owner_id=? AND e.equipped_slot IS NOT NULL AND e.upgrade_tier>0
    `).all(String(userId));
    for (const item of upgraded) {
      const value = Number(item.upgrade_tier) * 2;
      const stat = item.category === 'weapon'
        ? 'atk'
        : item.category === 'staff'
          ? 'magic_atk'
          : 'def';
      total[stat] = (total[stat] || 0) + value;
    }
    const setCounts = db.prepare(`
      SELECT set_id,count(1) pieces FROM rpg_equipment_instances
      WHERE owner_id=? AND equipped_slot IS NOT NULL AND set_id IS NOT NULL GROUP BY set_id
    `).all(String(userId));
    for (const entry of setCounts) {
      const set = content.sets.find(item => item.id === entry.set_id);
      if (!set) continue;
      for (const [required, bonus] of Object.entries(set.bonuses)) {
        if (entry.pieces < Number(required)) continue;
        for (const [stat, value] of Object.entries(bonus)) total[stat] = (total[stat] || 0) + value;
      }
    }
    return total;
  }

  function upgrade(userId, instanceId, operationKey) {
    const item = getInstance(userId, instanceId);
    if (!item) return { success: false, reason: 'Equipment instance tidak ditemukan.' };
    if (item.upgrade_tier >= 15) return { success: false, reason: 'Upgrade sudah maksimal.' };
    const nextTier = item.upgrade_tier + 1;
    const requirement = upgradeRequirements(nextTier);
    const goldCost = requirement.gold;
    const user = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
    if (!user || user.gold < goldCost) return { success: false, reason: `Butuh ${goldCost}g.` };
    const materials = requirement.materials.map(entry => ({
      ...entry,
      row: db.prepare('SELECT * FROM rpg_inventory WHERE telegram_user_id=? AND item_id=?')
        .get(String(userId), entry.itemId),
    }));
    const missing = materials.find(entry => !entry.row || entry.row.quantity < entry.quantity);
    if (missing) return { success: false, reason: `Butuh ${missing.quantity} ${missing.itemId.replace(/_/g, ' ')}.` };
    return db.transaction(() => {
      const existing = db.prepare('SELECT id FROM rpg_equipment_operations WHERE operation_key=?').get(String(operationKey));
      if (existing) return { success: false, reason: 'Operasi ini sudah diproses.' };
      db.prepare('UPDATE rpg_users SET gold=gold-?,updated_at=? WHERE telegram_user_id=?')
        .run(goldCost, now(), String(userId));
      for (const material of materials) {
        if (material.row.quantity === material.quantity) {
          db.prepare('DELETE FROM rpg_inventory WHERE id=?').run(material.row.id);
        } else {
          db.prepare('UPDATE rpg_inventory SET quantity=quantity-? WHERE id=?')
            .run(material.quantity, material.row.id);
        }
      }
      const powerGain = 3;
      db.prepare(`
        UPDATE rpg_equipment_instances SET upgrade_tier=?,item_power=item_power+?,updated_at=?
        WHERE id=? AND owner_id=?
      `).run(nextTier, powerGain, now(), item.id, String(userId));
      db.prepare(`
        INSERT INTO rpg_equipment_operations
          (operation_key,instance_id,owner_id,operation,gold_cost,materials_json,result_json,created_at)
        VALUES (?,?,?,'upgrade',?,?,?,?)
      `).run(String(operationKey), item.id, String(userId), goldCost,
        JSON.stringify(Object.fromEntries(materials.map(entry => [entry.itemId, entry.quantity]))),
        JSON.stringify({ tier: nextTier, powerGain }), now());
      ledger.record({
        entryKey: `equipment_upgrade:${operationKey}`, userId, amount: -goldCost,
        balanceAfter: user.gold - goldCost, reason: 'equipment_upgrade',
        referenceType: 'equipment', referenceId: item.id,
      });
      return { success: true, goldCost, materials: requirement.materials, item: getInstance(userId, item.id) };
    })();
  }

  function reforge(userId, instanceId, operationKey) {
    const item = getInstance(userId, instanceId);
    if (!item) return { success: false, reason: 'Equipment instance tidak ditemukan.' };
    if (!item.affixes.length) return { success: false, reason: 'Equipment ini tidak memiliki affix.' };
    const catalystCost = 1 + Math.floor(Number(item.reforge_count || 0) / 3);
    const goldCost = 250 + item.item_power * 3 + Number(item.reforge_count || 0) * 200;
    const user = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
    const catalyst = db.prepare(`
      SELECT * FROM rpg_inventory WHERE telegram_user_id=? AND item_id='reforge_catalyst'
    `).get(String(userId));
    if (!user || user.gold < goldCost) return { success: false, reason: `Butuh ${goldCost}g.` };
    if (!catalyst || catalyst.quantity < catalystCost) {
      return { success: false, reason: `Butuh ${catalystCost} Katalis Reforge.` };
    }
    return db.transaction(() => {
      const existing = db.prepare('SELECT id FROM rpg_equipment_operations WHERE operation_key=?').get(String(operationKey));
      if (existing) return { success: false, reason: 'Operasi ini sudah diproses.' };
      db.prepare('UPDATE rpg_users SET gold=gold-?,updated_at=? WHERE telegram_user_id=?')
        .run(goldCost, now(), String(userId));
      if (catalyst.quantity === catalystCost) db.prepare('DELETE FROM rpg_inventory WHERE id=?').run(catalyst.id);
      else db.prepare('UPDATE rpg_inventory SET quantity=quantity-? WHERE id=?').run(catalystCost, catalyst.id);
      db.prepare('DELETE FROM rpg_equipment_affixes WHERE instance_id=?').run(item.id);
      const owner = db.prepare('SELECT class_name FROM rpg_users WHERE telegram_user_id=?')
        .get(String(userId));
      rollAffixes(item.id, item.category, item.affixes.length, item.quality, owner?.class_name);
      db.prepare('UPDATE rpg_equipment_instances SET reforge_count=reforge_count+1,updated_at=? WHERE id=?')
        .run(now(), item.id);
      const result = getInstance(userId, item.id);
      db.prepare(`
        INSERT INTO rpg_equipment_operations
          (operation_key,instance_id,owner_id,operation,gold_cost,materials_json,result_json,created_at)
        VALUES (?,?,?,'reforge',?,?,?,?)
      `).run(String(operationKey), item.id, String(userId), goldCost,
        JSON.stringify({ reforge_catalyst: catalystCost }),
        JSON.stringify({ affixes: result.affixes }), now());
      ledger.record({
        entryKey: `equipment_reforge:${operationKey}`, userId, amount: -goldCost,
        balanceAfter: user.gold - goldCost, reason: 'equipment_reforge',
        referenceType: 'equipment', referenceId: item.id,
      });
      return { success: true, goldCost, catalystCost, item: result };
    })();
  }

  function salvage(userId, instanceId, operationKey) {
    const prior = db.prepare('SELECT rewards_json FROM rpg_equipment_salvage_receipts WHERE operation_key=?')
      .get(String(operationKey));
    if (prior) return { success: true, duplicate: true, rewards: JSON.parse(prior.rewards_json) };
    const item = getInstance(userId, instanceId);
    if (!item) return { success: false, reason: 'Equipment tidak ditemukan atau sudah dibongkar.' };
    if (item.equipped_slot) return { success: false, reason: 'Lepas gear terlebih dahulu sebelum salvage.' };
    const rarityYield = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
    const materialId = item.item_level <= 10 ? 'tembaga'
      : item.item_level <= 25 ? 'besi_rongsok'
        : item.item_level <= 40 ? 'perak' : 'obsidian_murni';
    const rewards = {
      [materialId]: (rarityYield[item.rarity] || 1) + Math.floor(item.upgrade_tier / 5),
    };
    if (['rare', 'epic', 'legendary'].includes(item.rarity)) {
      rewards.reforge_catalyst = item.rarity === 'legendary' ? 2 : 1;
    }
    const filledSockets = item.sockets.filter(socket => socket.gem_item_id).length;
    if (filledSockets) rewards.gem_dust = filledSockets;
    return db.transaction(() => {
      for (const [itemId, quantity] of Object.entries(rewards)) {
        db.prepare(`
          INSERT INTO rpg_inventory (telegram_user_id,item_id,quantity)
          VALUES (?,?,?) ON CONFLICT(telegram_user_id,item_id)
          DO UPDATE SET quantity=quantity+excluded.quantity
        `).run(String(userId), itemId, quantity);
      }
      db.prepare(`
        INSERT INTO rpg_equipment_salvage_receipts
          (operation_key,instance_id,owner_id,item_snapshot_json,rewards_json,created_at)
        VALUES (?,?,?,?,?,?)
      `).run(String(operationKey), item.id, String(userId), JSON.stringify(item), JSON.stringify(rewards), now());
      db.prepare('DELETE FROM rpg_equipment_instances WHERE id=? AND owner_id=?')
        .run(item.id, String(userId));
      return { success: true, rewards };
    })();
  }

  return { getInstance, list, forge, equip, socketGem, bonuses, upgrade, reforge, salvage };
}

module.exports = {
  CONTENT_FILE, EQUIPMENT_SLOTS, RARITY_RULES,
  calculateItemPower, upgradeRequirements, loadEquipmentContent, createEquipmentService,
};
