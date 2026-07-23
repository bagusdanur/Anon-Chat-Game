const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runRpgMigrations } = require('../src/rpg/migrations');
const { createFeatureFlagService } = require('../src/rpg/services/featureFlags');
const { createLedgerService } = require('../src/rpg/services/ledger');
const { loadRegions, publishRegions } = require('../src/rpg/services/contentRegistry');
const { weightedPick, createWorldService } = require('../src/rpg/services/world');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE rpg_users (
      telegram_user_id TEXT PRIMARY KEY,
      level INTEGER NOT NULL DEFAULT 1,
      gold INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO rpg_users (telegram_user_id, level, gold) VALUES ('1', 1, 0);
  `);
  runRpgMigrations(db, { backup: false });
  return db;
}

test('migrations are ordered and idempotent', () => {
  const db = createTestDb();
  const secondRun = runRpgMigrations(db, { backup: false });
  assert.deepEqual(secondRun.applied, []);
  const versions = db.prepare(
    "SELECT version FROM schema_migrations WHERE scope = 'rpg' ORDER BY version",
  ).all();
  assert.deepEqual(versions, [{ version: 1 }, { version: 2 }]);
  db.close();
});

test('feature flags reject unknown keys', () => {
  const db = createTestDb();
  const flags = createFeatureFlagService(db);
  assert.equal(flags.isEnabled('world_v2'), true);
  flags.set('world_v2', false);
  assert.equal(flags.isEnabled('world_v2'), false);
  assert.throws(() => flags.set('typo_flag', true), /Unknown feature flag/);
  db.close();
});

test('currency ledger is immutable and idempotent by entry key', () => {
  const db = createTestDb();
  const ledger = createLedgerService(db);
  ledger.record({
    entryKey: 'reward:quest:1:user:1',
    userId: '1',
    amount: 10,
    balanceAfter: 10,
    reason: 'quest_reward',
  });
  assert.throws(() => ledger.record({
    entryKey: 'reward:quest:1:user:1',
    userId: '1',
    amount: 10,
    reason: 'quest_reward',
  }), /UNIQUE/);
  assert.throws(
    () => db.prepare('UPDATE rpg_currency_ledger SET amount = 99 WHERE id = 1').run(),
    /immutable/,
  );
  db.close();
});

test('region content publishes and world progress persists', () => {
  const db = createTestDb();
  const regions = loadRegions();
  publishRegions(db, regions);
  const world = createWorldService(db, { random: () => 0 });
  const initial = world.getProgress('1');
  assert.equal(initial.current_region_id, 'aldenmoor_outskirts');
  const result = world.explore('1');
  assert.equal(result.success, true);
  assert.equal(result.encounter.id, 'misty_trail');
  assert.equal(result.progress.exploration_points, 1);
  db.close();
});

test('weighted encounter selection honors boundaries', () => {
  const items = [{ id: 'a', weight: 1 }, { id: 'b', weight: 3 }];
  assert.equal(weightedPick(items, () => 0).id, 'a');
  assert.equal(weightedPick(items, () => 0.99).id, 'b');
});
