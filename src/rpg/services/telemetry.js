function collectRpgTelemetry(db, featureFlags) {
  const economy = db.prepare(`
    SELECT coalesce(sum(CASE WHEN amount>0 THEN amount ELSE 0 END),0) sources,
      abs(coalesce(sum(CASE WHEN amount<0 THEN amount ELSE 0 END),0)) sinks,
      count(1) ledger_entries FROM rpg_currency_ledger
  `).get();
  const totalGold = db.prepare('SELECT coalesce(sum(gold),0) total FROM rpg_users').get().total;
  const market = db.prepare(`
    SELECT sum(CASE WHEN status='active' THEN 1 ELSE 0 END) active,
      sum(CASE WHEN status='sold' THEN 1 ELSE 0 END) sold,
      coalesce(sum(CASE WHEN status='sold' THEN quantity*unit_price ELSE 0 END),0) volume
    FROM rpg_market_listings
  `).get();
  const count = sql => db.prepare(sql).get().count;
  const sessions = {
    dungeons: count("SELECT count(1) count FROM rpg_dungeon_sessions_v2 WHERE status='active'"),
    raids: count("SELECT count(1) count FROM rpg_raid_instances WHERE status='active'"),
    trades: count("SELECT count(1) count FROM rpg_trade_sessions_v2 WHERE status='pending'"),
    parties: count("SELECT count(1) count FROM rpg_parties WHERE status='active'"),
    guilds: count('SELECT count(1) count FROM rpg_guilds'),
  };
  const content = {
    regions: count('SELECT count(1) count FROM rpg_regions WHERE published=1'),
    skills: count('SELECT count(1) count FROM rpg_skill_definitions WHERE published=1'),
    dungeons: count('SELECT count(1) count FROM rpg_dungeon_definitions WHERE published=1'),
    quests: count('SELECT count(1) count FROM rpg_campaign_definitions WHERE published=1'),
    raids: count('SELECT count(1) count FROM rpg_raid_definitions WHERE published=1'),
  };
  const anomalies = {
    negativeGold: count('SELECT count(1) count FROM rpg_users WHERE gold<0'),
    invalidInventory: count('SELECT count(1) count FROM rpg_inventory WHERE quantity<=0'),
    expiredActiveDungeon: count(`
      SELECT count(1) count FROM rpg_dungeon_sessions_v2
      WHERE status='active' AND expires_at<=strftime('%s','now')
    `),
  };
  const migrations = db.prepare(`
    SELECT version,name,applied_at FROM schema_migrations
    WHERE scope='rpg' ORDER BY version DESC
  `).all();
  const season = db.prepare(`
    SELECT season_id,name,starts_at,ends_at,status FROM rpg_seasons
    ORDER BY starts_at DESC LIMIT 1
  `).get() || null;
  return {
    economy: {
      ...economy, totalGold,
      sourceSinkRatio: economy.sinks ? Number((economy.sources / economy.sinks).toFixed(2)) : null,
    },
    market, sessions, content, anomalies, migrations, season,
    featureFlags: featureFlags.list(),
  };
}

module.exports = { collectRpgTelemetry };
