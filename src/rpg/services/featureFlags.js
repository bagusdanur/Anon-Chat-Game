const DEFAULT_FLAGS = {
  world_v2: true,
  character_builds_v2: true,
  marketplace_v2: false,
  recoverable_sessions_v2: false,
  long_dungeons_v2: true,
  seasons_v2: false,
};

function createFeatureFlagService(db) {
  const now = () => Math.floor(Date.now() / 1000);
  const seed = db.prepare(`
    INSERT OR IGNORE INTO rpg_feature_flags (flag_key, enabled, description, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  for (const [key, enabled] of Object.entries(DEFAULT_FLAGS)) {
    seed.run(key, enabled ? 1 : 0, `RPG v2 feature: ${key}`, now());
  }

  return {
    isEnabled(key) {
      const row = db.prepare('SELECT enabled FROM rpg_feature_flags WHERE flag_key = ?').get(key);
      return row ? row.enabled === 1 : false;
    },
    list() {
      return db.prepare('SELECT * FROM rpg_feature_flags ORDER BY flag_key').all();
    },
    set(key, enabled) {
      if (!Object.prototype.hasOwnProperty.call(DEFAULT_FLAGS, key)) {
        throw new Error(`Unknown feature flag: ${key}`);
      }
      db.prepare('UPDATE rpg_feature_flags SET enabled = ?, updated_at = ? WHERE flag_key = ?')
        .run(enabled ? 1 : 0, now(), key);
    },
  };
}

module.exports = { DEFAULT_FLAGS, createFeatureFlagService };
