const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../../..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const equipmentContent = readJson('data/rpg_affixes.json');
const CATEGORY_LABELS = {
  consumable: '🧪 Consumable', material: '📦 Material', weapon: '⚔️ Senjata',
  staff: '🪄 Staff', armor: '🛡️ Armor', accessory: '💍 Aksesori',
};

function loadItemSourceContent() {
  const content = readJson('data/rpg_item_sources.json');
  if (!content || typeof content.sources !== 'object') throw new Error('Item source content tidak valid.');
  return content;
}

function createItemCatalogService(db, options = {}) {
  const sourceContent = options.sourceContent || loadItemSourceContent();
  const shops = options.shops || readJson('data/rpg_shops.json');
  const crafting = options.crafting || readJson('data/rpg_crafting.json');
  const monsters = options.monsters || readJson('data/rpg_monsters.json');

  function dynamicSources(itemId) {
    const sources = new Set(sourceContent.sources[itemId]?.sources || []);
    const shopEntries = [...(shops.shop_items || []), ...(shops.special_shop || [])]
      .filter(entry => entry.item_id === itemId);
    for (const entry of shopEntries) {
      const limit = entry.weekly_limit ? ` · ${entry.weekly_limit}/minggu` : '';
      sources.add(`🏪 Shop${entry.min_level ? ` · Lv.${entry.min_level}+` : ''}${limit}`);
    }
    for (const recipe of crafting.recipes || []) {
      if (recipe.result === itemId) sources.add(`⚒ /craft [${recipe.id}] ${recipe.name}`);
    }
    for (const [activity, table] of Object.entries({
      hunt: monsters.hunt_loot || {}, fish: monsters.fish_loot || {}, mine: monsters.mine_loot || {},
    })) {
      if (JSON.stringify(table).includes(`"${itemId}"`)) {
        sources.add(activity === 'hunt' ? '⚔ /hunt' : activity === 'fish' ? '🐟 /fish' : '⛏ /mine');
      }
    }
    return [...sources];
  }

  function uses(itemId, item = {}) {
    const result = [];
    for (const recipe of crafting.recipes || []) {
      if (recipe.materials?.some(material => material.item === itemId)) result.push(`Bahan ${recipe.name}`);
    }
    if (itemId === 'ore_upgrade') result.push('Dipakai oleh /upgrade');
    if (itemId === 'reforge_catalyst') result.push('Dipakai oleh /gear reforge');
    if (['ruby_gem', 'sapphire_gem', 'emerald_gem'].includes(itemId)) result.push('Dipakai oleh /gear socket');
    if (['weapon', 'staff', 'armor', 'accessory'].includes(item.category)) {
      result.push('Forge lewat /gear forge [nomor dari /inv]');
      const classFit = item.category === 'staff'
        ? 'Cocok: Penyihir'
        : item.category === 'weapon'
          ? 'Cocok: Ksatria dan Assassin'
          : 'Cocok: semua class';
      result.push(classFit);
      if (['rare', 'epic', 'legendary'].includes(item.rarity)) result.push('Memiliki socket setelah forge');
      const set = equipmentContent.sets.find(entry => entry.items.includes(itemId));
      if (set) result.push(`Bagian set: ${set.name}`);
    }
    return result;
  }

  function all(userId) {
    const owned = new Set(db.prepare(`
      SELECT item_id FROM rpg_inventory WHERE telegram_user_id=? AND quantity>0
      UNION SELECT item_id FROM rpg_equipment_instances WHERE owner_id=?
    `).all(String(userId), String(userId)).map(row => row.item_id));
    return db.prepare(`
      SELECT item_id,display_name,category,rarity,effect_json FROM items_catalog
      ORDER BY CASE category WHEN 'consumable' THEN 1 WHEN 'material' THEN 2 WHEN 'weapon' THEN 3
        WHEN 'staff' THEN 4 WHEN 'armor' THEN 5 WHEN 'accessory' THEN 6 ELSE 9 END, rarity DESC, display_name
    `).all().map((item, index) => ({
      ...item, number: index + 1, owned: owned.has(item.item_id), sources: dynamicSources(item.item_id), uses: uses(item.item_id, item),
    }));
  }

  function validate() {
    const missing = all('__catalog_validation__').filter(item => item.sources.length === 0).map(item => item.item_id);
    if (missing.length) throw new Error(`Item tanpa sumber: ${missing.join(', ')}`);
    return true;
  }

  return { all, validate, labels: CATEGORY_LABELS };
}

module.exports = { CATEGORY_LABELS, loadItemSourceContent, createItemCatalogService };
