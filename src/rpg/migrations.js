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
  {
    version: 6,
    name: 'profession_event_receipts',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_profession_events (
        event_key TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        profession_id TEXT NOT NULL,
        xp_amount INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_profession_events_user
        ON rpg_profession_events(user_id, profession_id, created_at);
    `,
  },
  {
    version: 7,
    name: 'controlled_marketplace',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_market_listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price INTEGER NOT NULL CHECK (unit_price > 0),
        upgrade_tier INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','sold','cancelled','expired')),
        buyer_id TEXT,
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_market_active
        ON rpg_market_listings(status, item_id, unit_price, expires_at);
      CREATE INDEX IF NOT EXISTS idx_market_seller
        ON rpg_market_listings(seller_id, status, created_at);

      CREATE TABLE IF NOT EXISTS rpg_market_sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        listing_id INTEGER NOT NULL UNIQUE REFERENCES rpg_market_listings(id),
        seller_id TEXT NOT NULL,
        buyer_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        gross_amount INTEGER NOT NULL,
        tax_amount INTEGER NOT NULL,
        seller_proceeds INTEGER NOT NULL,
        sold_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 8,
    name: 'season_and_endgame',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_seasons (
        season_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('scheduled','active','ended')),
        modifiers_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_season_progress (
        season_id TEXT NOT NULL REFERENCES rpg_seasons(season_id),
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        points INTEGER NOT NULL DEFAULT 0,
        currency INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (season_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS rpg_season_events (
        event_key TEXT PRIMARY KEY,
        season_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        points INTEGER NOT NULL,
        currency INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_season_rank
        ON rpg_season_progress(season_id, points DESC);

      CREATE TABLE IF NOT EXISTS rpg_tower_progress (
        user_id TEXT PRIMARY KEY REFERENCES rpg_users(telegram_user_id),
        best_floor INTEGER NOT NULL DEFAULT 0,
        attempts INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        last_attempt_at INTEGER,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rpg_achievement_unlocks (
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        achievement_id TEXT NOT NULL,
        unlocked_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, achievement_id)
      );
    `,
  },
  {
    version: 9,
    name: 'persistent_parties_and_guilds',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_character_aliases (
        user_id TEXT PRIMARY KEY REFERENCES rpg_users(telegram_user_id),
        alias TEXT NOT NULL UNIQUE COLLATE NOCASE,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','disbanded')),
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_party_members (
        user_id TEXT PRIMARY KEY REFERENCES rpg_users(telegram_user_id),
        party_id INTEGER NOT NULL REFERENCES rpg_parties(id),
        role TEXT NOT NULL DEFAULT 'member'
          CHECK (role IN ('owner','member')),
        joined_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_party_members_party
        ON rpg_party_members(party_id, joined_at);
      CREATE TABLE IF NOT EXISTS rpg_party_invites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        party_id INTEGER NOT NULL REFERENCES rpg_parties(id),
        inviter_id TEXT NOT NULL,
        invitee_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','accepted','rejected','expired')),
        expires_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_party_invite_pending
        ON rpg_party_invites(invitee_id, status, expires_at);

      CREATE TABLE IF NOT EXISTS rpg_guilds (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tag TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL UNIQUE COLLATE NOCASE,
        owner_id TEXT NOT NULL,
        level INTEGER NOT NULL DEFAULT 1,
        treasury INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_guild_members (
        user_id TEXT PRIMARY KEY REFERENCES rpg_users(telegram_user_id),
        guild_id INTEGER NOT NULL REFERENCES rpg_guilds(id),
        role TEXT NOT NULL DEFAULT 'member'
          CHECK (role IN ('owner','officer','member')),
        contribution INTEGER NOT NULL DEFAULT 0,
        joined_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_guild_members_guild
        ON rpg_guild_members(guild_id, contribution DESC);
      CREATE TABLE IF NOT EXISTS rpg_guild_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        created_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 10,
    name: 'asynchronous_world_boss_and_weekly_raid',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_raid_definitions (
        raid_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        raid_type TEXT NOT NULL CHECK (raid_type IN ('world','party')),
        definition_json TEXT NOT NULL,
        published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
        content_version INTEGER NOT NULL DEFAULT 1,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_raid_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raid_id TEXT NOT NULL REFERENCES rpg_raid_definitions(raid_id),
        period_key TEXT NOT NULL,
        scope_key TEXT NOT NULL,
        max_hp INTEGER NOT NULL CHECK (max_hp > 0),
        current_hp INTEGER NOT NULL CHECK (current_hp >= 0),
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','defeated','expired')),
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        defeated_at INTEGER,
        created_at INTEGER NOT NULL,
        UNIQUE (raid_id, period_key, scope_key)
      );
      CREATE INDEX IF NOT EXISTS idx_raid_instances_active
        ON rpg_raid_instances(raid_id, status, ends_at);

      CREATE TABLE IF NOT EXISTS rpg_raid_contributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        instance_id INTEGER NOT NULL REFERENCES rpg_raid_instances(id),
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        damage INTEGER NOT NULL CHECK (damage > 0),
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_raid_contribution_rank
        ON rpg_raid_contributions(instance_id, damage DESC);

      CREATE TABLE IF NOT EXISTS rpg_raid_reward_claims (
        instance_id INTEGER NOT NULL REFERENCES rpg_raid_instances(id),
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        reward_json TEXT NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (instance_id, user_id)
      );
    `,
  },
  {
    version: 11,
    name: 'guild_roles_and_weekly_quests',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_guild_quest_progress (
        guild_id INTEGER NOT NULL REFERENCES rpg_guilds(id),
        period_key TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        current INTEGER NOT NULL DEFAULT 0 CHECK (current >= 0),
        target INTEGER NOT NULL CHECK (target > 0),
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','completed','claimed')),
        updated_at INTEGER NOT NULL,
        claimed_at INTEGER,
        PRIMARY KEY (guild_id, period_key, quest_id)
      );
      CREATE TABLE IF NOT EXISTS rpg_guild_quest_events (
        event_key TEXT PRIMARY KEY,
        guild_id INTEGER NOT NULL,
        period_key TEXT NOT NULL,
        quest_id TEXT NOT NULL,
        amount INTEGER NOT NULL CHECK (amount > 0),
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rpg_guild_role_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id INTEGER NOT NULL,
        actor_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('promote','demote','kick')),
        created_at INTEGER NOT NULL
      );
    `,
  },
  {
    version: 12,
    name: 'duo_bounties',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_duo_bounties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        party_id INTEGER NOT NULL REFERENCES rpg_parties(id),
        period_key TEXT NOT NULL,
        target INTEGER NOT NULL CHECK (target > 0),
        progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0),
        status TEXT NOT NULL DEFAULT 'active'
          CHECK (status IN ('active','completed','expired')),
        created_at INTEGER NOT NULL,
        completed_at INTEGER,
        UNIQUE (party_id, period_key)
      );
      CREATE TABLE IF NOT EXISTS rpg_duo_bounty_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_key TEXT NOT NULL UNIQUE,
        bounty_id INTEGER NOT NULL REFERENCES rpg_duo_bounties(id),
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        amount INTEGER NOT NULL CHECK (amount > 0),
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_duo_bounty_actions
        ON rpg_duo_bounty_actions(bounty_id, user_id);
      CREATE TABLE IF NOT EXISTS rpg_duo_bounty_claims (
        bounty_id INTEGER NOT NULL REFERENCES rpg_duo_bounties(id),
        user_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        reward_json TEXT NOT NULL,
        claimed_at INTEGER NOT NULL,
        PRIMARY KEY (bounty_id, user_id)
      );
    `,
  },
  {
    version: 13,
    name: 'equipment_instances_affixes_and_sockets',
    up: `
      CREATE TABLE IF NOT EXISTS rpg_equipment_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_id TEXT NOT NULL REFERENCES rpg_users(telegram_user_id),
        item_id TEXT NOT NULL,
        rarity TEXT NOT NULL,
        quality INTEGER NOT NULL CHECK (quality BETWEEN 1 AND 100),
        item_power INTEGER NOT NULL CHECK (item_power > 0),
        upgrade_tier INTEGER NOT NULL DEFAULT 0 CHECK (upgrade_tier BETWEEN 0 AND 15),
        bind_status TEXT NOT NULL DEFAULT 'unbound'
          CHECK (bind_status IN ('unbound','account_bound')),
        equipped_slot TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_equipment_owner
        ON rpg_equipment_instances(owner_id, equipped_slot, item_power DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_equipment_one_per_slot
        ON rpg_equipment_instances(owner_id, equipped_slot)
        WHERE equipped_slot IS NOT NULL;

      CREATE TABLE IF NOT EXISTS rpg_equipment_affixes (
        instance_id INTEGER NOT NULL REFERENCES rpg_equipment_instances(id) ON DELETE CASCADE,
        affix_id TEXT NOT NULL,
        stat_key TEXT NOT NULL,
        stat_value REAL NOT NULL,
        tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
        PRIMARY KEY (instance_id, affix_id)
      );
      CREATE TABLE IF NOT EXISTS rpg_equipment_sockets (
        instance_id INTEGER NOT NULL REFERENCES rpg_equipment_instances(id) ON DELETE CASCADE,
        socket_index INTEGER NOT NULL,
        gem_item_id TEXT,
        stat_key TEXT,
        stat_value REAL,
        PRIMARY KEY (instance_id, socket_index)
      );

      INSERT OR IGNORE INTO items_catalog
        (item_id,display_name,category,rarity,sell_price,effect_json)
      VALUES
        ('ruby_gem','Ruby Gem','material','rare',25,'{"socket_stat":"atk","value":4}'),
        ('sapphire_gem','Sapphire Gem','material','rare',25,'{"socket_stat":"magic_atk","value":4}'),
        ('emerald_gem','Emerald Gem','material','rare',25,'{"socket_stat":"def","value":4}');
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
