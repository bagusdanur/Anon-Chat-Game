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
    magic_atk        INTEGER NOT NULL DEFAULT 0,
    crit_rate        REAL NOT NULL DEFAULT 0.05,
    crit_multi       REAL NOT NULL DEFAULT 1.5,
    phys_resist      REAL NOT NULL DEFAULT 0,
    magic_resist     REAL NOT NULL DEFAULT 0,
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
    category     TEXT NOT NULL CHECK (category IN ('consumable','material','weapon','staff','armor','accessory')),
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

  CREATE TABLE IF NOT EXISTS status_effects (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT NOT NULL,
    effect_type  TEXT NOT NULL CHECK (effect_type IN ('burn','bleed','stun','shield')),
    duration     INTEGER NOT NULL DEFAULT 3,
    power        REAL NOT NULL DEFAULT 0,
    created_at   INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_inventory_user ON rpg_inventory(telegram_user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions_log(from_user_id, to_user_id);
  CREATE INDEX IF NOT EXISTS idx_dungeon_players ON dungeon_runs(player_a_id, player_b_id);
  CREATE INDEX IF NOT EXISTS idx_status_effects_user ON status_effects(user_id);

  CREATE TABLE IF NOT EXISTS quests (
    quest_id     TEXT PRIMARY KEY,
    name         TEXT NOT NULL,
    description  TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('daily','weekly','once')),
    action_type  TEXT NOT NULL,
    target_count INTEGER NOT NULL DEFAULT 1,
    xp_reward    INTEGER NOT NULL DEFAULT 0,
    gold_reward  INTEGER NOT NULL DEFAULT 0,
    item_reward  TEXT,
    created_at   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS quest_progress (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      TEXT NOT NULL,
    quest_id     TEXT NOT NULL,
    current      INTEGER NOT NULL DEFAULT 0,
    claimed      BOOLEAN NOT NULL DEFAULT 0,
    reset_at     INTEGER NOT NULL DEFAULT 0,
    UNIQUE(user_id, quest_id, reset_at)
  );

  CREATE INDEX IF NOT EXISTS idx_quest_progress_user ON quest_progress(user_id);
`);

// ===== MIGRATE: tambah kolom baru jika belum ada =====
try { db.exec('ALTER TABLE rpg_users ADD COLUMN magic_atk INTEGER DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE rpg_users ADD COLUMN crit_rate REAL DEFAULT 0.05'); } catch(e) {}
try { db.exec('ALTER TABLE rpg_users ADD COLUMN crit_multi REAL DEFAULT 1.5'); } catch(e) {}
try { db.exec('ALTER TABLE rpg_users ADD COLUMN phys_resist REAL DEFAULT 0'); } catch(e) {}
try { db.exec('ALTER TABLE rpg_users ADD COLUMN magic_resist REAL DEFAULT 0'); } catch(e) {}

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
  { item_id: 'pedang_karatan', display_name: '⚔️ Pedang Karatan', category: 'weapon', rarity: 'rare',      sell_price: 30,  effect_json: JSON.stringify({ atk_bonus: 2, crit_rate: 0.05 }) },
  { item_id: 'jubah_terkutuk', display_name: '🧥 Jubah Terkutuk', category: 'armor',  rarity: 'epic',      sell_price: 0,   effect_json: JSON.stringify({ def_bonus: 5, magic_resist: 0.10 }) },
  // staffs (magic weapons)
  { item_id: 'tongkat_ranting', display_name: '🪄 Tongkat Ranting', category: 'staff', rarity: 'uncommon', sell_price: 20,  effect_json: JSON.stringify({ magic_atk_bonus: 3 }) },
  { item_id: 'tongkat_api',     display_name: '🔥 Tongkat Api',     category: 'staff', rarity: 'rare',     sell_price: 60,  effect_json: JSON.stringify({ magic_atk_bonus: 6, crit_rate: 0.08 }) },
  // accessories
  { item_id: 'cincin_perak',    display_name: '💍 Cincin Perak',    category: 'accessory', rarity: 'uncommon', sell_price: 25,  effect_json: JSON.stringify({ crit_rate: 0.05 }) },
  { item_id: 'kalung_kekuatan', display_name: '📿 Kalung Kekuatan', category: 'accessory', rarity: 'rare',     sell_price: 80,  effect_json: JSON.stringify({ atk_bonus: 3, magic_atk_bonus: 3 }) },
  { item_id: 'amulet_pertahanan',display_name:'🛡️ Amulet Pertahanan',category: 'accessory',rarity: 'rare',    sell_price: 80,  effect_json: JSON.stringify({ def_bonus: 3, phys_resist: 0.05, magic_resist: 0.05 }) },
  // legendary raid drops
  { item_id: 'pedang_goblin',  display_name: '🗡️ Pedang Goblin Bertuah',  category: 'weapon', rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ atk_bonus: 6, crit_rate: 0.10, crit_multi: 0.3 }) },
  { item_id: 'jaring_sutra',   display_name: '🕸️ Jaring Sutra Ratu',      category: 'armor',  rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ def_bonus: 8, magic_resist: 0.15 }) },
  { item_id: 'mahkota_terkutuk',display_name:'👑 Mahkota Terkutuk',       category: 'accessory', rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ atk_bonus: 5, magic_atk_bonus: 5, def_bonus: 5, crit_rate: 0.10 }) },
  // shop tools
  { item_id: 'kail_plus',      display_name: '🎣 Kail Pancing+',  category: 'material', rarity: 'uncommon', sell_price: 80, effect_json: JSON.stringify({ fish_rarity_boost: 1 }) },
  { item_id: 'beliung_plus',   display_name: '⛏️ Beliung Tambang+',category: 'material',rarity: 'uncommon', sell_price: 120, effect_json: JSON.stringify({ mine_rarity_boost: 1 }) },
  // craftable weapons
  { item_id: 'pedang_besi',     display_name: '🗡️ Pedang Besi',     category: 'weapon', rarity: 'rare',     sell_price: 80,  effect_json: JSON.stringify({ atk_bonus: 4, crit_rate: 0.05 }) },
  { item_id: 'pedang_naga',     display_name: '🐉 Pedang Naga',     category: 'weapon', rarity: 'legendary', sell_price: 0,   effect_json: JSON.stringify({ atk_bonus: 8, crit_rate: 0.12, crit_multi: 0.3 }) },
  // craftable staffs
  { item_id: 'tongkat_es',      display_name: '❄️ Tongkat Es',      category: 'staff', rarity: 'legendary', sell_price: 0,   effect_json: JSON.stringify({ magic_atk_bonus: 10, crit_rate: 0.10 }) },
  // craftable armor
  { item_id: 'perisai_besi',    display_name: '🛡️ Perisai Besi',    category: 'armor', rarity: 'rare',     sell_price: 60,  effect_json: JSON.stringify({ def_bonus: 4, phys_resist: 0.05 }) },
  { item_id: 'armor_naga',      display_name: '🐉 Armor Naga',      category: 'armor', rarity: 'legendary', sell_price: 0,   effect_json: JSON.stringify({ def_bonus: 10, phys_resist: 0.15, magic_resist: 0.10 }) },
  // craftable accessories
  { item_id: 'cincin_keberuntungan', display_name: '💍 Cincin Keberuntungan', category: 'accessory', rarity: 'rare', sell_price: 100, effect_json: JSON.stringify({ crit_rate: 0.08, atk_bonus: 2 }) },
  { item_id: 'kalung_naga',     display_name: '🐉 Kalung Naga',     category: 'accessory', rarity: 'legendary', sell_price: 0, effect_json: JSON.stringify({ atk_bonus: 4, magic_atk_bonus: 4, crit_rate: 0.10, phys_resist: 0.05 }) },
];

const insertItem = db.prepare(`
  INSERT OR IGNORE INTO items_catalog (item_id, display_name, category, rarity, sell_price, effect_json)
  VALUES (@item_id, @display_name, @category, @rarity, @sell_price, @effect_json)
`);
const seedAll = db.transaction(() => { SEED_ITEMS.forEach(i => insertItem.run(i)); });
seedAll();

// ===== CLASS DEFINITIONS =====
const CLASS_DEFS = {
  ksatria: {
    name: '⚔️ Ksatria', damageType: 'physical',
    base_hp: 50, base_atk: 5, base_def: 5, base_magic_atk: 0,
    base_crit_rate: 0.05, base_crit_multi: 1.5,
    growth: { hp: 8, atk: 1.5, def: 2, magic_atk: 0 },
    physBonus: 1.15, magicBonus: 0.80,  // +15% phys, -20% magic
    skillName: 'Tebasan Besar', skillMulti: 2.0, skillType: 'physical',
    skillDesc: 'Tebasan kuat dengan bonus armor penetrate 10%'
  },
  penyihir: {
    name: '🔥 Penyihir', damageType: 'magic',
    base_hp: 35, base_atk: 3, base_def: 2, base_magic_atk: 8,
    base_crit_rate: 0.10, base_crit_multi: 1.8,
    growth: { hp: 5, atk: 0.5, def: 1, magic_atk: 2.5 },
    physBonus: 0.70, magicBonus: 1.25,  // -30% phys, +25% magic
    skillName: 'Bola Api', skillMulti: 2.5, skillType: 'magic',
    skillDesc: 'Bola api yang membakar musuh selama 3 turn'
  },
  pencuri: {
    name: '🗡️ Pencuri', damageType: 'physical',
    base_hp: 40, base_atk: 6, base_def: 3, base_magic_atk: 0,
    base_crit_rate: 0.15, base_crit_multi: 2.0,
    growth: { hp: 6, atk: 2, def: 1.5, magic_atk: 0 },
    physBonus: 1.20, magicBonus: 0.80,  // +20% phys, -20% magic
    skillName: 'Backstab', skillMulti: 3.0, skillType: 'physical',
    skillDesc: 'Serangan dari belakang — 100% Crit!'
  },
};

function calcStats(className, level) {
  const cls = CLASS_DEFS[className];
  return {
    max_hp:    Math.floor(cls.base_hp + cls.growth.hp * (level - 1)),
    atk:       Math.floor(cls.base_atk + cls.growth.atk * (level - 1)),
    def:       Math.floor(cls.base_def + cls.growth.def * (level - 1)),
    magic_atk: Math.floor(cls.base_magic_atk + cls.growth.magic_atk * (level - 1)),
    crit_rate: cls.base_crit_rate + (level - 1) * (className === 'pencuri' ? 0.015 : className === 'penyihir' ? 0.01 : 0.005),
    crit_multi: cls.base_crit_multi,
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
     magic_atk, crit_rate, crit_multi, phys_resist, magic_resist,
     energy_current, energy_last_update, last_dungeon_at, created_at, updated_at)
    VALUES (?, ?, 1, 0, 0, ?, ?, ?, ?, ?, ?, ?, 0, 0, 10, ?, NULL, ?, ?)
  `).run(id, className, stats.max_hp, stats.max_hp, stats.atk, stats.def,
         stats.magic_atk, stats.crit_rate, stats.crit_multi, now, now, now);
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
// Ambil bonus dari semua equipment: 1 weapon, 1 staff, 1 armor, 1 accessory
function getEquipmentBonus(userId) {
  const items = getInventory(userId);
  let atkBonus = 0, defBonus = 0, magicAtkBonus = 0, critRate = 0, critMulti = 0;
  let physResist = 0, magicResist = 0;

  const equipped = { weapon: null, staff: null, armor: null, accessory: null };
  for (const item of items) {
    if (!item.effect_json || !['weapon', 'staff', 'armor', 'accessory'].includes(item.category)) continue;
    // Ambil terbaik per slot
    if (equipped[item.category] && equipped[item.category].rarity > item.rarity) continue;
    equipped[item.category] = item;
  }

  for (const [, item] of Object.entries(equipped)) {
    if (!item || !item.effect_json) continue;
    try {
      const eff = JSON.parse(item.effect_json);
      const tier = item.upgrade_tier || 0;
      const tierBonus = tier * 2;
      if (eff.atk_bonus) atkBonus = Math.max(atkBonus, eff.atk_bonus + tierBonus);
      if (eff.def_bonus) defBonus = Math.max(defBonus, eff.def_bonus + tierBonus);
      if (eff.magic_atk_bonus) magicAtkBonus = Math.max(magicAtkBonus, eff.magic_atk_bonus + tierBonus);
      if (eff.crit_rate) critRate += eff.crit_rate;
      if (eff.crit_multi) critMulti += eff.crit_multi;
      if (eff.phys_resist) physResist += eff.phys_resist;
      if (eff.magic_resist) magicResist += eff.magic_resist;
    } catch {}
  }

  return { atkBonus, defBonus, magicAtkBonus, critRate, critMulti, physResist, magicResist };
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
  db.prepare(`UPDATE rpg_users SET level = ?, xp = ?, max_hp = ?, atk = ?, def = ?,
    magic_atk = ?, crit_rate = ?, crit_multi = ?, updated_at = ? WHERE telegram_user_id = ?`)
    .run(level, xp, stats.max_hp, stats.atk, stats.def,
         stats.magic_atk, stats.crit_rate, stats.crit_multi, now, id);

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

// ===== STATUS EFFECTS =====
function addStatusEffect(userId, effectType, duration, power) {
  db.prepare('INSERT INTO status_effects (user_id, effect_type, duration, power, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(userId.toString(), effectType, duration, power, Math.floor(Date.now() / 1000));
}

function getStatusEffects(userId) {
  return db.prepare('SELECT * FROM status_effects WHERE user_id = ?').all(userId.toString());
}

function tickStatusEffects(userId) {
  const effects = getStatusEffects(userId);
  const logs = [];
  for (const eff of effects) {
    if (eff.effect_type === 'burn') {
      const dmg = Math.floor(eff.power);
      logs.push(`🔥 ${userId} terbakar! *-${dmg} HP*`);
    } else if (eff.effect_type === 'bleed') {
      const dmg = Math.floor(eff.power);
      logs.push(`🩸 ${userId} berdarah! *-${dmg} HP*`);
    }
  }
  // Kurangi duration
  db.prepare('UPDATE status_effects SET duration = duration - 1 WHERE user_id = ?').run(userId.toString());
  // Hapus yang habis
  db.prepare('DELETE FROM status_effects WHERE user_id = ? AND duration <= 0').run(userId.toString());
  return logs;
}

function hasStatusEffect(userId, effectType) {
  return db.prepare('SELECT 1 FROM status_effects WHERE user_id = ? AND effect_type = ?').get(userId.toString(), effectType);
}

function clearStatusEffects(userId) {
  db.prepare('DELETE FROM status_effects WHERE user_id = ?').run(userId.toString());
}

// ===== QUEST SYSTEM =====
const DAILY_QUESTS = [
  { quest_id: 'daily_hunt_3',    name: '🗡️ Pemburu Pemula',       description: 'Hunt monster 3 kali',       type: 'daily', action_type: 'hunt',     target_count: 3,  xp_reward: 50,  gold_reward: 30 },
  { quest_id: 'daily_fish_3',    name: '🎣 Pemancing Ulung',       description: 'Mancing 3 kali',            type: 'daily', action_type: 'fish',     target_count: 3,  xp_reward: 40,  gold_reward: 25, item_reward: null },
  { quest_id: 'daily_mine_2',    name: '⛏️ Penambang Rajin',      description: 'Menambang 2 kali',          type: 'daily', action_type: 'mine',     target_count: 2,  xp_reward: 60,  gold_reward: 35 },
  { quest_id: 'daily_craft_1',   name: '⚒️ Tukang Crafts',        description: 'Craft 1 item apapun',        type: 'daily', action_type: 'craft',    target_count: 1,  xp_reward: 40,  gold_reward: 20, item_reward: null },
  { quest_id: 'daily_sell_3',    name: '💰 Pedagang Kecil',        description: 'Jual 3 item',               type: 'daily', action_type: 'sell',     target_count: 3,  xp_reward: 30,  gold_reward: 40, item_reward: null },
  { quest_id: 'daily_dungeon_1', name: '🏰 Penjelajah Dungeon',   description: 'Selesaikan 1 dungeon raid',  type: 'daily', action_type: 'dungeon',  target_count: 1,  xp_reward: 100, gold_reward: 50, item_reward: 'ramuan_kecil' },
  { quest_id: 'daily_give_1',    name: '🤝 Dermawan',             description: 'Kirim gold ke partner 1 kali',type: 'daily', action_type: 'give',     target_count: 1,  xp_reward: 30,  gold_reward: 15, item_reward: null },
  { quest_id: 'daily_upgrade_1', name: '⬆️ Upgrade Master',       description: 'Upgrade equipment 1 kali',   type: 'daily', action_type: 'upgrade',  target_count: 1,  xp_reward: 50,  gold_reward: 25, item_reward: null },
  { quest_id: 'daily_use_1',     name: '🧪 Apoteker',             description: 'Pakai item 1 kali',          type: 'daily', action_type: 'use',      target_count: 1,  xp_reward: 20,  gold_reward: 10, item_reward: null },
  { quest_id: 'daily_chat_10',   name: '💬 Social Butterfly',     description: 'Kirim 10 pesan ke partner',  type: 'daily', action_type: 'message',  target_count: 10, xp_reward: 30,  gold_reward: 20, item_reward: null },
];

// Seed quests ke database
const insertQuest = db.prepare(`
  INSERT OR IGNORE INTO quests (quest_id, name, description, type, action_type, target_count, xp_reward, gold_reward, item_reward, created_at)
  VALUES (@quest_id, @name, @description, @type, @action_type, @target_count, @xp_reward, @gold_reward, @item_reward, 0)
`);
const seedQuests = db.transaction(() => { DAILY_QUESTS.forEach(q => insertQuest.run(q)); });
seedQuests();

function getTodayReset() {
  // Reset harian jam 00:00 UTC+7
  const now = new Date();
  const utc7 = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  utc7.setHours(0, 0, 0, 0);
  return Math.floor(utc7.getTime() / 1000);
}

function getQuestProgress(userId, questId) {
  const resetAt = getTodayReset();
  return db.prepare('SELECT * FROM quest_progress WHERE user_id = ? AND quest_id = ? AND reset_at = ?')
    .get(userId.toString(), questId, resetAt);
}

function incrementQuestProgress(userId, actionType) {
  const resetAt = getTodayReset();
  const quests = db.prepare('SELECT * FROM quests WHERE action_type = ?').all(actionType);
  for (const quest of quests) {
    if (quest.type !== 'daily') continue;
    const progress = getQuestProgress(userId, quest.quest_id);
    if (!progress) {
      // Create new progress
      db.prepare('INSERT INTO quest_progress (user_id, quest_id, current, claimed, reset_at) VALUES (?, ?, 1, 0, ?)')
        .run(userId.toString(), quest.quest_id, resetAt);
    } else if (progress.current < quest.target_count && !progress.claimed) {
      db.prepare('UPDATE quest_progress SET current = current + 1 WHERE id = ?')
        .run(progress.id);
    }
  }
}

function claimQuest(userId, questId) {
  const resetAt = getTodayReset();
  const progress = getQuestProgress(userId, questId);
  if (!progress || progress.claimed) return { success: false, reason: 'sudah diklaim atau belum ada progress' };

  const quest = db.prepare('SELECT * FROM quests WHERE quest_id = ?').get(questId);
  if (!quest) return { success: false, reason: 'quest tidak ditemukan' };
  if (progress.current < quest.target_count) return { success: false, reason: 'belum selesai' };

  // Mark claimed
  db.prepare('UPDATE quest_progress SET claimed = 1 WHERE id = ?').run(progress.id);

  // Give rewards
  if (quest.xp_reward > 0) addXp(userId, quest.xp_reward);
  if (quest.gold_reward > 0) addGold(userId, quest.gold_reward);
  if (quest.item_reward) addItem(userId, quest.item_reward);

  return { success: true, quest, progress };
}

function getAllDailyQuests(userId) {
  const resetAt = getTodayReset();
  return DAILY_QUESTS.map(q => {
    const progress = getQuestProgress(userId, q.quest_id);
    return {
      ...q,
      current: progress ? progress.current : 0,
      claimed: progress ? progress.claimed : false,
      done: progress ? progress.current >= q.target_count : false,
    };
  });
}

// ===== DAMAGE CALCULATION =====
function calcPhysicalDamage(attacker, defender, baseDmg, skillMulti = 1, ignoreDef = 0) {
  const cls = CLASS_DEFS[attacker.classId || attacker.class_name];
  const bonus = cls ? cls.physBonus : 1.0;
  const raw = Math.floor(baseDmg * skillMulti * bonus);
  const def = Math.max(0, (defender.def || 0) * (1 - ignoreDef));
  const mitigated = Math.max(1, raw - Math.floor(def / 2));
  // Apply defender phys resist
  const resist = defender.phys_resist || 0;
  return Math.max(1, Math.floor(mitigated * (1 - resist)));
}

function calcMagicDamage(attacker, defender, baseDmg, skillMulti = 1) {
  const cls = CLASS_DEFS[attacker.classId || attacker.class_name];
  const bonus = cls ? cls.magicBonus : 1.0;
  const raw = Math.floor(baseDmg * skillMulti * bonus);
  // Magic uses def/3 for mitigation (lower than physical)
  const def = Math.max(0, (defender.def || 0) / 3);
  const mitigated = Math.max(1, raw - Math.floor(def));
  // Apply defender magic resist
  const resist = defender.magic_resist || 0;
  return Math.max(1, Math.floor(mitigated * (1 - resist)));
}

function rollCrit(critRate, critMulti) {
  const roll = Math.random();
  const isCrit = roll < critRate;
  return { isCrit, multiplier: isCrit ? critMulti : 1 };
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
  // Status effects
  addStatusEffect, getStatusEffects, tickStatusEffects, hasStatusEffect, clearStatusEffects,
  // Damage calculation
  calcPhysicalDamage, calcMagicDamage, rollCrit,
  // Quest system
  incrementQuestProgress, claimQuest, getAllDailyQuests,
};
