// src/rpg/db_rpg.js
// Layer database khusus untuk sistem RPG persistent
const { db } = require('../db');

// ===== SCHEMA =====
db.exec(`
  CREATE TABLE IF NOT EXISTS rpg_users (
    telegram_user_id TEXT PRIMARY KEY,
    class_name       TEXT NOT NULL DEFAULT 'ksatria' CHECK (class_name IN ('ksatria','penyihir','pencuri')),
    level            INTEGER NOT NULL DEFAULT 1,
    xp               INTEGER NOT NULL DEFAULT 0,
    gold             INTEGER NOT NULL DEFAULT 0,
    hp               INTEGER NOT NULL DEFAULT 50,
    max_hp           INTEGER NOT NULL DEFAULT 50,
    atk              INTEGER NOT NULL DEFAULT 5,
    def              INTEGER NOT NULL DEFAULT 5,
    energy_current   INTEGER NOT NULL DEFAULT 10,
    energy_last_update INTEGER NOT NULL DEFAULT 0,
    last_dungeon_at  INTEGER DEFAULT NULL,
    last_daily_claim_at INTEGER DEFAULT NULL,
    created_at       INTEGER NOT NULL DEFAULT 0,
    updated_at       INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS rpg_inventory (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
    item_id          TEXT NOT NULL,
    quantity         INTEGER NOT NULL DEFAULT 1,
    upgrade_tier     INTEGER DEFAULT 0,
    UNIQUE(telegram_user_id, item_id)
  );

  CREATE TABLE IF NOT EXISTS items_catalog (
    item_id      TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    category     TEXT NOT NULL CHECK (category IN ('consumable','material','weapon','armor')),
    rarity       TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
    sell_price   INTEGER DEFAULT 0,
    effect_json  TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    from_user_id TEXT,
    to_user_id   TEXT,
    amount       INTEGER NOT NULL,
    reason       TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS dungeon_runs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    player_a_id  TEXT NOT NULL,
    player_b_id  TEXT NOT NULL,
    boss_id      TEXT NOT NULL,
    result       TEXT NOT NULL CHECK (result IN ('win','lose','abandoned')),
    loot_json    TEXT,
    started_at   INTEGER NOT NULL,
    ended_at     INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_user ON rpg_inventory(telegram_user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions_log(from_user_id, to_user_id);
  CREATE INDEX IF NOT EXISTS idx_dungeon_players ON dungeon_runs(player_a_id, player_b_id);
`);

// ===== SEED ITEMS CATALOG =====
const SEED_ITEMS = [
  // consumables
  { item_id: 'ramuan_kecil',   display_name: '🧪 Ramuan Kecil',   category: 'consumable', rarity: 'uncommon', sell_price: 7,  effect_json: JSON.stringify({ heal_pct: 15 }) },
  { item_id: 'ramuan_besar',   display_name: '🧪 Ramuan Besar',   category: 'consumable', rarity: 'rare',     sell_price: 25, effect_json: JSON.stringify({ heal_pct: 50 }) },
  // materials
  { item_id: 'daging_mentah',  display_name: '🥩 Daging Mentah',  category: 'material', rarity: 'common',   sell_price: 3,   effect_json: null },
  { item_id: 'kulit_kasar',    display_name: '🪨 Kulit Kasar',    category: 'material', rarity: 'common',   sell_price: 5,   effect_json: null },
  { item_id: 'besi_rongsok',   display_name: '⚙️ Besi Rongsok',   category: 'material', rarity: 'uncommon', sell_price: 12,  effect_json: null },
  { item_id: 'tembaga',        display_name: '🟫 Tembaga',        category: 'material', rarity: 'common',   sell_price: 8,   effect_json: null },
  { item_id: 'batu_bara',      display_name: '⬛ Batu Bara',      category: 'material', rarity: 'common',   sell_price: 6,   effect_json: null },
  { item_id: 'besi',           display_name: '🔩 Besi',           category: 'material', rarity: 'uncommon', sell_price: 20,  effect_json: null },
  { item_id: 'perak',          display_name: '⬜ Perak',          category: 'material', rarity: 'rare',     sell_price: 50,  effect_json: null },
  { item_id: 'emas_ore',       display_name: '🟡 Bijih Emas',     category: 'material', rarity: 'epic',     sell_price: 150, effect_json: null },
  { item_id: 'berlian',        display_name: '💎 Berlian',        category: 'material', rarity: 'legendary',sell_price: 300, effect_json: null },
  { item_id: 'fragmen_naga',   display_name: '🐉 Fragmen Naga',   category: 'material', rarity: 'legendary',sell_price: 250, effect_json: null },
  { item_id: 'sisik_naga',     display_name: '🐉 Sisik Naga',     category: 'material', rarity: 'legendary',sell_price: 0,   effect_json: null },
  // ikan
  { item_id: 'ikan_teri',      display_name: '🐟 Ikan Teri',      category: 'material', rarity: 'common',   sell_price: 3,   effect_json: null },
  { item_id: 'ikan_mujair',    display_name: '🐠 Ikan Mujair',    category: 'material', rarity: 'common',   sell_price: 6,   effect_json: null },
  { item_id: 'ikan_salmon',    display_name: '🐡 Ikan Salmon',    category: 'material', rarity: 'uncommon', sell_price: 15,  effect_json: null },
  { item_id: 'kepiting',       display_name: '🦀 Kepiting',       category: 'material', rarity: 'uncommon', sell_price: 22,  effect_json: null },
  { item_id: 'mutiara',        display_name: '🫧 Mutiara',        category: 'material', rarity: 'epic',     sell_price: 120, effect_json: null },
  { item_id: 'sepatu_rusak',   display_name: '👟 Sepatu Bot Rusak',category: 'material', rarity: 'common',  sell_price: 0,   effect_json: null },
  // weapons & armor (dari loot)
  { item_id: 'pedang_karatan', display_name: '⚔️ Pedang Karatan', category: 'weapon', rarity: 'rare',      sell_price: 30,  effect_json: JSON.stringify({ atk_bonus: 2 }) },
  { item_id: 'jubah_terkutuk', display_name: '🧥 Jubah Terkutuk', category: 'armor',  rarity: 'epic',      sell_price: 0,   effect_json: JSON.stringify({ def_bonus: 5 }) },
  // legendary raid drops
  { item_id: 'pedang_goblin',  display_name: '🗡️ Pedang Goblin Bertuah',  category: 'weapon', rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ atk_bonus: 6 }) },
  { item_id: 'jaring_sutra',   display_name: '🕸️ Jaring Sutra Ratu',      category: 'armor',  rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ def_bonus: 8 }) },
  { item_id: 'mahkota_terkutuk',display_name:'👑 Mahkota Terkutuk',       category: 'armor',  rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ atk_bonus: 10, def_bonus: 10 }) },
  // shop tools
  { item_id: 'kail_plus',      display_name: '🎣 Kail Pancing+',  category: 'material', rarity: 'uncommon', sell_price: 80, effect_json: JSON.stringify({ fish_rarity_boost: 1 }) },
  { item_id: 'beliung_plus',   display_name: '⛏️ Beliung Tambang+',category: 'material',rarity: 'uncommon', sell_price: 120, effect_json: JSON.stringify({ mine_rarity_boost: 1 }) },
];

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO items_catalog (item_id, display_name, category, rarity, sell_price, effect_json)
  VALUES (@item_id, @display_name, @category, @rarity, @sell_price, @effect_json)
`);
const seedAll = db.transaction(() => { SEED_ITEMS.forEach(i => insertItem.run(i)); });
seedAll();

// ===== CLASS DEFINITIONS =====
const CLASS_DEFS = {
  ksatria: { name: '⚔️ Ksatria', base_hp: 50, base_atk: 5, base_def: 5, growth: { hp: 8, atk: 1.5, def: 2 } },
  penyihir: { name: '🔥 Penyihir', base_hp: 35, base_atk: 8, base_def: 2, growth: { hp: 5, atk: 2.5, def: 1 } },
  pencuri: { name: '🗡️ Pencuri', base_hp: 40, base_atk: 6, base_def: 3, growth: { hp: 6, atk: 2, def: 1.5 } },
};

function calcStats(className, level) {
  const cls = CLASS_DEFS[className];
  return {
    max_hp: Math.floor(cls.base_hp + cls.growth.hp * (level - 1)),
    atk:    Math.floor(cls.base_atk + cls.growth.atk * (level - 1)),
    def:    Math.floor(cls.base_def + cls.growth.def * (level - 1)),
  };
}

function xpToNextLevel(level) {
  return Math.floor(50 * Math.pow(level, 1.5));
}

// ===== USER CRUD =====
function getOrCreateUser(userId) {
  const id = userId.toString();
  let user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(id);
  if (!user) return null; // belum bikin karakter — harus /profile dulu
  return user;
}

function createUser(userId, className) {
  const id = userId.toString();
  const now = Math.floor(Date.now() / 1000);
  const stats = calcStats(className, 1);
  db.prepare(`
    INSERT OR IGNORE INTO rpg_users
    (telegram_user_id, class_name, level, xp, gold, hp, max_hp, atk, def,
     energy_current, energy_last_update, last_dungeon_at, created_at, updated_at)
    VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?, 10, ?, NULL, ?, ?)
  `).run(id, className, stats.max_hp, stats.max_hp, stats.atk, stats.def, now, now, now);
  return db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(id);
}

// Lazy regen energi (+1 per 3 menit — lebih cepat untuk sesi anonymous chat)
function getCurrentEnergy(user) {
  const now = Math.floor(Date.now() / 1000);
  const elapsedMin = Math.floor((now - user.energy_last_update) / 60);
  const regen = Math.floor(elapsedMin / 3); // 3 menit per +1 energi (full dari 0 = 27 menit)
  return Math.min(10, user.energy_current + regen);
}

function spendEnergy(userId, cost) {
  const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(userId.toString());
  const now = Math.floor(Date.now() / 1000);
  const current = getCurrentEnergy(user);
  if (current < cost) return false;
  db.prepare('UPDATE rpg_users SET energy_current = ?, energy_last_update = ?, updated_at = ? WHERE telegram_user_id = ?')
    .run(current - cost, now, now, userId.toString());
  return true;
}

// Lazy regen HP (+10% max_hp per 10 menit)
function getCurrentHp(user) {
  const now = Math.floor(Date.now() / 1000);
  const elapsedMin = Math.floor((now - user.updated_at) / 60);
  const regenTicks = Math.floor(elapsedMin / 10);
  const regenAmount = Math.floor(user.max_hp * 0.1) * regenTicks;
  return Math.min(user.max_hp, user.hp + regenAmount);
}

// ===== EQUIPMENT BONUS =====
// Ambil bonus terbaik: 1 senjata (max ATK) + 1 armor (max DEF)
// Tidak perlu sistem equip eksplisit — otomatis ambil terbaik di inventory
function getEquipmentBonus(userId) {
  const items = getInventory(userId);
  let atkBonus = 0;
  let defBonus = 0;
  for (const item of items) {
    if (!item.effect_json || !['weapon', 'armor'].includes(item.category)) continue;
    try {
      const eff = JSON.parse(item.effect_json);
      const upgradeBonus = (item.upgrade_tier || 0) * 2;
      if (item.category === 'weapon' && eff.atk_bonus) {
        atkBonus = Math.max(atkBonus, eff.atk_bonus + upgradeBonus);
      }
      if (item.category === 'armor') {
        if (eff.def_bonus) defBonus = Math.max(defBonus, eff.def_bonus + upgradeBonus);
        // Mahkota Terkutuk: bonus ATK + DEF dari armor
        if (eff.atk_bonus) atkBonus = Math.max(atkBonus, eff.atk_bonus + upgradeBonus);
      }
    } catch {}
  }
  return { atkBonus, defBonus };
}

// ===== DUNGEON COOLDOWN (ganti sistem tiket) =====
// Cooldown 30 menit per pemain setelah tiap run dungeon
const DUNGEON_COOLDOWN_SECS = 10 * 60; // 10 menit — pas untuk durasi sesi anonymous chat

function getDungeonCooldown(user) {
  if (!user.last_dungeon_at) return 0; // belum pernah raid
  const now = Math.floor(Date.now() / 1000);
  const remaining = DUNGEON_COOLDOWN_SECS - (now - user.last_dungeon_at);
  return Math.max(0, remaining);
}

function setDungeonCooldown(userId) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE rpg_users SET last_dungeon_at = ?, updated_at = ? WHERE telegram_user_id = ?')
    .run(now, now, userId.toString());
}

// Tambah XP + auto level-up, kembalikan info level-up
function addXp(userId, amount) {
  const id = userId.toString();
  let user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(id);
  if (!user) return { leveled: false };

  let { level, xp } = user;
  xp += amount;
  const leveled = [];

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level++;
    leveled.push(level);
  }

  const stats = calcStats(user.class_name, level);
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE rpg_users SET level = ?, xp = ?, max_hp = ?, atk = ?, def = ?, updated_at = ? WHERE telegram_user_id = ?')
    .run(level, xp, stats.max_hp, stats.atk, stats.def, now, id);

  return { leveled, newLevel: level };
}

function addGold(userId, amount) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE rpg_users SET gold = MAX(0, gold + ?), updated_at = ? WHERE telegram_user_id = ?')
    .run(amount, now, userId.toString());
  logTransaction(null, userId, amount, 'reward');
}

function spendGold(userId, amount) {
  const user = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(userId.toString());
  if (!user || user.gold < amount) return false;
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE rpg_users SET gold = gold - ?, updated_at = ? WHERE telegram_user_id = ?').run(amount, now, userId.toString());
  logTransaction(userId, null, amount, 'spend');
  return true;
}

function updateHp(userId, newHp) {
  const now = Math.floor(Date.now() / 1000);
  db.prepare('UPDATE rpg_users SET hp = ?, updated_at = ? WHERE telegram_user_id = ?').run(newHp, now, userId.toString());
}

// ===== INVENTORY =====
function addItem(userId, itemId, qty = 1) {
  db.prepare(`
    INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(telegram_user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity
  `).run(userId.toString(), itemId, qty);
}

function removeItem(userId, itemId, qty = 1) {
  const row = db.prepare('SELECT quantity FROM rpg_inventory WHERE telegram_user_id = ? AND item_id = ?').get(userId.toString(), itemId);
  if (!row || row.quantity < qty) return false;
  if (row.quantity === qty) {
    db.prepare('DELETE FROM rpg_inventory WHERE telegram_user_id = ? AND item_id = ?').run(userId.toString(), itemId);
  } else {
    db.prepare('UPDATE rpg_inventory SET quantity = quantity - ? WHERE telegram_user_id = ? AND item_id = ?').run(qty, userId.toString(), itemId);
  }
  return true;
}

function getInventory(userId) {
  return db.prepare(`
    SELECT i.item_id, i.quantity, i.upgrade_tier, c.display_name, c.category, c.rarity, c.sell_price, c.effect_json
    FROM rpg_inventory i
    JOIN items_catalog c ON i.item_id = c.item_id
    WHERE i.telegram_user_id = ?
    ORDER BY c.category, c.rarity DESC
  `).all(userId.toString());
}

function getItem(userId, itemId) {
  return db.prepare(`
    SELECT i.*, c.display_name, c.category, c.rarity, c.effect_json, c.sell_price
    FROM rpg_inventory i JOIN items_catalog c ON i.item_id = c.item_id
    WHERE i.telegram_user_id = ? AND i.item_id = ?
  `).get(userId.toString(), itemId);
}

function upgradeItem(userId, itemId) {
  const inv = db.prepare('SELECT upgrade_tier FROM rpg_inventory WHERE telegram_user_id = ? AND item_id = ?').get(userId.toString(), itemId);
  if (!inv || inv.upgrade_tier >= 5) return false;
  db.prepare('UPDATE rpg_inventory SET upgrade_tier = upgrade_tier + 1 WHERE telegram_user_id = ? AND item_id = ?').run(userId.toString(), itemId);
  return true;
}

// ===== TRANSACTIONS =====
function logTransaction(fromId, toId, amount, reason) {
  db.prepare('INSERT INTO transactions_log (from_user_id, to_user_id, amount, reason, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(fromId ? fromId.toString() : null, toId ? toId.toString() : null, amount, reason, Math.floor(Date.now() / 1000));
}

// ===== DUNGEON RUNS =====
function createDungeonRun(playerAId, playerBId, bossId) {
  const info = db.prepare(`
    INSERT INTO dungeon_runs (player_a_id, player_b_id, boss_id, result, started_at)
    VALUES (?, ?, ?, 'lose', ?)
  `).run(playerAId.toString(), playerBId.toString(), bossId, Math.floor(Date.now() / 1000));
  return info.lastInsertRowid;
}

function finalizeDungeonRun(runId, result, lootJson) {
  db.prepare('UPDATE dungeon_runs SET result = ?, loot_json = ?, ended_at = ? WHERE id = ?')
    .run(result, lootJson ? JSON.stringify(lootJson) : null, Math.floor(Date.now() / 1000), runId);
}


function getCatalogItem(itemId) {
  return db.prepare('SELECT * FROM items_catalog WHERE item_id = ?').get(itemId);
}

module.exports = {
  CLASS_DEFS, calcStats, xpToNextLevel,
  getOrCreateUser, createUser,
  getCurrentEnergy, spendEnergy, getCurrentHp,
  getDungeonCooldown, setDungeonCooldown, updateHp,
  getEquipmentBonus,
  addXp, addGold, spendGold,
  addItem, removeItem, getInventory, getItem, upgradeItem,
  logTransaction,
  createDungeonRun, finalizeDungeonRun,
  getCatalogItem,
};
