const test = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { runRpgMigrations } = require('../src/rpg/migrations');
const { createFeatureFlagService } = require('../src/rpg/services/featureFlags');
const { createLedgerService } = require('../src/rpg/services/ledger');
const { loadRegions, publishRegions } = require('../src/rpg/services/contentRegistry');
const { weightedPick, createWorldService } = require('../src/rpg/services/world');
const {
  loadSkills,
  publishSkills,
  totalSkillPoints,
  createSkillService,
} = require('../src/rpg/services/skills');
const {
  rankedValue,
  tickSkillCooldowns,
  getSkillCooldown,
  findLoadoutSkill,
  resolveCombatSkill,
} = require('../src/rpg/services/combatSkills');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE rpg_users (
      telegram_user_id TEXT PRIMARY KEY,
      class_name TEXT NOT NULL DEFAULT 'ksatria',
      level INTEGER NOT NULL DEFAULT 1,
      gold INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO rpg_users (telegram_user_id, class_name, level, gold)
    VALUES ('1', 'ksatria', 1, 1000);
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
  assert.deepEqual(versions, [{ version: 1 }, { version: 2 }, { version: 3 }]);
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

test('skill points grow every two levels', () => {
  assert.equal(totalSkillPoints(1), 1);
  assert.equal(totalSkillPoints(2), 1);
  assert.equal(totalSkillPoints(3), 2);
  assert.equal(totalSkillPoints(10), 5);
});

test('skill learning enforces level, class, points, and loadout slots', () => {
  const db = createTestDb();
  publishSkills(db, loadSkills());
  const skills = createSkillService(db);
  const first = skills.learn('1', 'ksatria_guard_stance');
  assert.equal(first.success, true);
  assert.equal(skills.availablePoints('1'), 0);
  assert.equal(skills.learn('1', 'penyihir_fireball').success, false);
  assert.equal(skills.learn('1', 'ksatria_heavy_slash').success, false);
  assert.equal(skills.equip('1', 'ksatria_guard_stance', 1).success, true);
  assert.equal(skills.getTree('1').skills.find(s => s.id === 'ksatria_guard_stance').equipped_slot, 1);
  db.close();
});

test('skill respec is atomic, audited, and cooldown protected', () => {
  const db = createTestDb();
  publishSkills(db, loadSkills());
  const clock = 2_000_000_000;
  const skills = createSkillService(db, { now: () => clock });
  assert.equal(skills.learn('1', 'ksatria_guard_stance').success, true);
  let result;
  try {
    result = skills.respec('1');
  } catch (error) {
    assert.fail(error.stack || error.message);
  }
  assert.equal(result.success, true);
  assert.equal(skills.getLearned('1').length, 0);
  assert.equal(db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get('1').gold, 725);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM rpg_currency_ledger').get().count, 1);
  assert.equal(skills.respecQuote('1').remaining > 0, true);
  db.close();
});

test('combat loadout contains only equipped skills in slot order', () => {
  const db = createTestDb();
  db.prepare('UPDATE rpg_users SET level = 3 WHERE telegram_user_id = ?').run('1');
  publishSkills(db, loadSkills());
  const skills = createSkillService(db);
  skills.learn('1', 'ksatria_guard_stance');
  skills.learn('1', 'ksatria_heavy_slash');
  skills.equip('1', 'ksatria_heavy_slash', 2);
  skills.equip('1', 'ksatria_guard_stance', 1);
  assert.deepEqual(
    skills.getCombatLoadout('1').map(skill => [skill.id, skill.slot]),
    [['ksatria_guard_stance', 1], ['ksatria_heavy_slash', 2]],
  );
  db.close();
});

test('combat skill resolves ranked damage and independent cooldown', () => {
  const attacker = {
    atk: 10, atkBonus: 0, critRate: 0, critMulti: 1.5,
    skillCooldowns: {},
    skillLoadout: [],
  };
  const defender = { def: 2, phys_resist: 0 };
  const skill = {
    id: 'test_slash',
    name: 'Test Slash',
    rank: 2,
    effect: { type: 'physical_damage', multiplier: [1.5, 2], cooldown: 2 },
  };
  const result = resolveCombatSkill({
    attacker,
    defender,
    skill,
    calcPhysicalDamage: (_a, _d, base, multiplier) => base * multiplier,
    calcMagicDamage: () => 0,
    rollCrit: () => ({ isCrit: false, multiplier: 1 }),
  });
  assert.equal(result.damage, 20);
  assert.equal(getSkillCooldown(attacker, 'test_slash'), 2);
  tickSkillCooldowns(attacker);
  assert.equal(getSkillCooldown(attacker, 'test_slash'), 1);
  assert.equal(rankedValue([10, 20], 99), 20);
});

test('defensive combat skills mutate temporary combat state', () => {
  const attacker = { skillCooldowns: {}, skillLoadout: [] };
  const skill = {
    id: 'guard',
    name: 'Guard',
    rank: 3,
    effect: { type: 'guard', reduction: [0.2, 0.3, 0.55], cooldown: 2 },
  };
  const result = resolveCombatSkill({
    attacker,
    defender: {},
    skill,
    calcPhysicalDamage: () => 0,
    calcMagicDamage: () => 0,
    rollCrit: () => ({ isCrit: false, multiplier: 1 }),
  });
  assert.equal(result.damage, 0);
  assert.equal(attacker.defending, true);
  assert.equal(attacker.guardReduction, 0.55);
  attacker.skillLoadout = [skill];
  assert.equal(findLoadoutSkill(attacker, 'guard').name, 'Guard');
});
