require('dotenv').config();

const path = require('path');
const { db } = require('../src/db');
const { createDatabaseBackup } = require('../src/rpg/services/databaseMaintenance');

const execute = process.argv.includes('--execute');
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../data/bot.db');

// Content/config tables must survive a fresh-player reset so the bot can serve
// its current saga immediately after the restart. Everything else in rpg_* is
// runtime/player state and is reset.
const PRESERVED_RPG_TABLES = new Set([
  'rpg_feature_flags',
  'rpg_regions',
  'rpg_skill_definitions',
  'rpg_dungeon_definitions',
  'rpg_campaign_definitions',
  'rpg_raid_definitions',
  'rpg_seasons',
]);

const LEGACY_RUNTIME_TABLES = [
  'rpg_users',
  'rpg_inventory',
  'transactions_log',
  'dungeon_runs',
  'status_effects',
  'quest_progress',
  'duel_history',
];

function quoteIdentifier(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function listResetTables() {
  const existing = new Set(
    db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name),
  );
  const runtimeRpgTables = [...existing]
    .filter((name) => name.startsWith('rpg_') && !PRESERVED_RPG_TABLES.has(name))
    .sort();
  const legacyTables = LEGACY_RUNTIME_TABLES.filter((name) => existing.has(name));
  return [...new Set([...runtimeRpgTables, ...legacyTables])];
}

function countRows(table) {
  return db.prepare(`SELECT count(*) AS count FROM ${quoteIdentifier(table)}`).get().count;
}

const tables = listResetTables();
const before = Object.fromEntries(tables.map((table) => [table, countRows(table)]));

if (!execute) {
  console.log(JSON.stringify({
    mode: 'dry-run',
    database: dbPath,
    resetTables: before,
    preservedRpgTables: [...PRESERVED_RPG_TABLES].sort(),
    message: 'Jalankan dengan --execute setelah bot dihentikan untuk reset permanen.',
  }, null, 2));
  db.close();
  process.exit(0);
}

const backup = createDatabaseBackup(db, dbPath, 'pre-rpg-reset');
const placeholders = tables.map(() => '?').join(',');
const triggers = db.prepare(
  `SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name IN (${placeholders}) AND sql IS NOT NULL`,
).all(...tables);

db.pragma('foreign_keys = OFF');
const reset = db.transaction(() => {
  for (const trigger of triggers) db.exec(`DROP TRIGGER ${quoteIdentifier(trigger.name)}`);
  for (const table of tables) db.exec(`DELETE FROM ${quoteIdentifier(table)}`);
  if (tables.length > 0) {
    db.prepare(`DELETE FROM sqlite_sequence WHERE name IN (${placeholders})`).run(...tables);
  }
  for (const trigger of triggers) db.exec(trigger.sql);
});

try {
  reset();
} finally {
  db.pragma('foreign_keys = ON');
}

db.exec('VACUUM');
const after = Object.fromEntries(tables.map((table) => [table, countRows(table)]));
const integrity = db.pragma('integrity_check', { simple: true });

console.log(JSON.stringify({
  mode: 'executed',
  backup,
  resetTables: after,
  integrity,
}, null, 2));
db.close();
