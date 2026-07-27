function collectRpgTelemetry(db, featureFlags) {
  const economy = db.prepare(`
    SELECT coalesce(sum(CASE
        WHEN reason NOT IN ('market_purchase','market_sale','direct_trade_send','direct_trade_receive',
                            'market_tax','direct_trade_tax')
          AND amount>0 THEN amount ELSE 0 END),0) sources,
      coalesce(sum(CASE
        WHEN reason IN ('market_tax','direct_trade_tax') THEN abs(amount)
        WHEN reason NOT IN ('market_purchase','market_sale','direct_trade_send','direct_trade_receive')
          AND amount<0 THEN abs(amount) ELSE 0 END),0) sinks,
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
  const dungeonBalance = db.prepare(`
    SELECT
      count(1) totalRuns,
      sum(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,
      sum(CASE WHEN status IN ('failed','abandoned') THEN 1 ELSE 0 END) unsuccessful,
      sum(CASE WHEN mode='solo' THEN 1 ELSE 0 END) soloRuns,
      sum(CASE WHEN mode='duo' THEN 1 ELSE 0 END) duoRuns,
      coalesce(sum(json_extract(state_json,'$.metrics.actions')),0) actions,
      coalesce(sum(json_extract(state_json,'$.metrics.attacks')),0) attacks,
      coalesce(sum(json_extract(state_json,'$.metrics.defends')),0) defends,
      coalesce(sum(json_extract(state_json,'$.metrics.skills')),0) skills,
      coalesce(sum(json_extract(state_json,'$.metrics.combos')),0) combos,
      coalesce(sum(json_extract(state_json,'$.metrics.enemyCycles')),0) enemyCycles,
      coalesce(avg(CASE WHEN completed_at IS NOT NULL
        THEN completed_at-created_at END),0) averageDurationSeconds
    FROM rpg_dungeon_sessions_v2
  `).get();
  const content = {
    regions: count('SELECT count(1) count FROM rpg_regions WHERE published=1'),
    skills: count('SELECT count(1) count FROM rpg_skill_definitions WHERE published=1'),
    dungeons: count('SELECT count(1) count FROM rpg_dungeon_definitions WHERE published=1'),
    quests: count('SELECT count(1) count FROM rpg_campaign_definitions WHERE published=1'),
    raids: count('SELECT count(1) count FROM rpg_raid_definitions WHERE published=1'),
  };
  const items = db.prepare(`
    SELECT
      (SELECT count(1) FROM items_catalog) catalog,
      (SELECT coalesce(sum(quantity),0) FROM rpg_inventory) inventoryUnits,
      (SELECT count(1) FROM rpg_equipment_instances) equipmentInstances,
      (SELECT coalesce(sum(quantity),0) FROM rpg_inventory
        WHERE item_id IN ('ruby_gem','sapphire_gem','emerald_gem')) gems,
      (SELECT coalesce(sum(quantity),0) FROM rpg_inventory
        WHERE item_id IN (
          'herba_kabut','sutra_racun','obsidian_murni','lotus_api',
          'serpihan_astral','kristal_nexus','air_mata_gerhana',
          'inti_antimateri','inti_supernova'
        )) regionMaterials
  `).get();
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
    market, sessions, dungeonBalance, items, content, anomalies, migrations, season,
    featureFlags: featureFlags.list(),
  };
}

module.exports = { collectRpgTelemetry };
