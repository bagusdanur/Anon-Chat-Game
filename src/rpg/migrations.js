// Migrasi RPG berurutan. Semua migrasi bersifat additive agar database produksi
// lama tetap bisa dipakai dan rollback cukup dilakukan lewat feature flag.
const fs = require('fs');
const path = require('path');

const MIGRATIONS = [
  {
    version: 1,
    name: 'rpg_v2_foundation',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_feature_flags (
        flag_key TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
        description TEXT,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rpg_currency_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_key TEXT NOT NULL UNIQUE,
        user_id TEXT,
        currency TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER,
        reason TEXT NOT NULL,
        reference_type TEXT,
        reference_id TEXT,
        metadata_json TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rpg_ledger_user
        ON rpg_currency_ledger(user_id, currency, created_at);

      CREATE TRIGGER IF NOT EXISTS trg_rpg_ledger_no_update
      BEFORE UPDATE ON rpg_currency_ledger
      BEGIN SELECT RAISE(ABORT, 'currency ledger is immutable'); END;

      CREATE TRIGGER IF NOT EXISTS trg_rpg_ledger_no_delete
      BEFORE DELETE ON rpg_currency_ledger
      BEGIN SELECT RAISE(ABORT, 'currency ledger is immutable'); END;

      CREATE TABLE IF NOT EXISTS rpg_regions (
        region_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        min_level INTEGER NOT NULL DEFAULT 1,
        travel_cost INTEGER NOT NULL DEFAULT 0,
        content_json TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
        content_version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rpg_world_progress (
        user_id TEXT PRIMARY KEY REFERENCES rpg_users(telegram_user_id),
        current_region_id TEXT NOT NULL DEFAULT 'aldenmoor_outskirts',
        campaign_chapter INTEGER NOT NULL DEFAULT 1,
        campaign_step INTEGER NOT NULL DEFAULT 0,
        exploration_points INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rpg_professions (
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        profession_id TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        xp INTEGER NOT NULL DEFAULT 0,
        mastery INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, profession_id)
      );

      CREATE TABLE IF NOT EXISTS rpg_session_snapshots (
        session_id TEXT PRIMARY KEY,
        session_type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        partner_id TEXT,
        state_json TEXT NOT NULL,
        state_version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active',
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rpg_sessions_owner
        ON rpg_session_snapshots(owner_id, status, expires_at);
    `,
  },
  {
    version: 2,
    name: 'rpg_character_builds',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_skill_definitions (
        skill_id TEXT PRIMARY KEY,
        class_id TEXT,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        max_rank INTEGER NOT NULL DEFAULT 1,
        definition_json TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rpg_user_skills (
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        skill_id TEXT NOT NULL REFERENCES rpg_skill_definitions(skill_id),
        rank INTEGER NOT NULL DEFAULT 1,
        equipped_slot INTEGER,
        unlocked_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, skill_id)
      );

      CREATE TABLE IF NOT EXISTS rpg_character_builds (
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        build_slot INTEGER NOT NULL,
        name TEXT NOT NULL,
        attributes_json TEXT NOT NULL DEFAULT '{}',
        skill_loadout_json TEXT NOT NULL DEFAULT '[]',
        active INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, build_slot)
      );
    `,
  },
  {
    version: 3,
    name: 'rpg_skill_progression',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_respec_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        gold_cost INTEGER NOT NULL,
        refunded_points INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_rpg_respec_user
        ON rpg_respec_history(user_id, created_at);
    `,
  },
  {
    version: 4,
    name: 'persistent_multi_room_dungeons',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_dungeon_definitions (
        dungeon_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        min_level INTEGER NOT NULL DEFAULT 1,
        definition_json TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        content_version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rpg_dungeon_sessions_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dungeon_id TEXT NOT NULL REFERENCES rpg_dungeon_definitions(dungeon_id),
        owner_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        partner_id TEXT,
        mode TEXT NOT NULL CHECK (mode IN ('solo','duo')),
        current_room_id TEXT NOT NULL,
        state_json TEXT NOT NULL,
        state_version INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','completed','failed','abandoned')),
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_rpg_dungeon_v2_owner
        ON rpg_dungeon_sessions_v2(owner_id, status, expires_at);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_rpg_one_active_solo_dungeon
        ON rpg_dungeon_sessions_v2(owner_id)
        WHERE status = 'active';

      CREATE TABLE IF NOT EXISTS rpg_dungeon_reward_claims (
        session_id INTEGER NOT NULL REFERENCES rpg_dungeon_sessions_v2(id),
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        reward_key TEXT NOT NULL,
        reward_json TEXT NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (session_id, user_id, reward_key)
      );
    `,
  },
  {
    version: 5,
    name: 'campaign_objective_engine',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_campaign_definitions (
        quest_id TEXT PRIMARY KEY,
        chapter INTEGER NOT NULL,
        sort_order INTEGER NOT NULL,
        title TEXT NOT NULL,
        definition_json TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0,
        content_version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_campaign_progress_v2 (
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        quest_id TEXT NOT NULL REFERENCES rpg_campaign_definitions(quest_id),
        objective_json TEXT NOT NULL DEFAULT '{}',
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','completed','claimed')),
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        claimed_at INTEGER,
        PRIMARY KEY (user_id, quest_id)
      );
      CREATE TABLE IF NOT EXISTS rpg_campaign_event_receipts (
        event_key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        target_id TEXT,
        amount INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_campaign_progress_user
        ON rpg_campaign_progress_v2(user_id, status);
    `,
  },
];

function quoteSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function createBackup(db, dbPath, nextVersion) {
  if (!dbPath || dbPath === ':memory:' || !fs.existsSync(dbPath)) return null;
  const backupDir = path.join(path.dirname(dbPath), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `pre-rpg-v${nextVersion}-${stamp}.db`);
  db.exec(`VACUUM INTO ${quoteSql(backupPath)}`);
  return backupPath;
}

function runRpgMigrations(db, options = {}) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      scope TEXT NOT NULL,
      version INTEGER NOT NULL,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL,
      PRIMARY KEY (scope, version)
    )
  `);

  const applied = new Set(
    db.prepare("SELECT version FROM schema_migrations WHERE scope = 'rpg'").all()
      .map(row => row.version),
  );
  const pending = MIGRATIONS.filter(migration => !applied.has(migration.version));
  if (pending.length === 0) return { applied: [], backupPath: null };

  const backupPath = options.backup === false
    ? null
    : createBackup(db, options.dbPath, pending[0].version);
  const record = db.prepare(
    "INSERT INTO schema_migrations (scope, version, name, applied_at) VALUES ('rpg', ?, ?, ?)",
  );

  const applyAll = db.transaction(() => {
    for (const migration of pending) {
      db.exec(migration.up);
      record.run(migration.version, migration.name, Math.floor(Date.now() / 1000));
    }
  });
  applyAll();

  return { applied: pending.map(item => item.version), backupPath };
}

module.exports = { MIGRATIONS, runRpgMigrations };
