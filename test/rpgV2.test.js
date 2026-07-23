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
const {
  loadDungeons,
  publishDungeons,
  createLongDungeonService,
} = require('../src/rpg/services/longDungeon');
const {
  loadCampaign,
  publishCampaign,
  createCampaignService,
} = require('../src/rpg/services/campaign');
const {
  professionXpToNext,
  createProfessionService,
} = require('../src/rpg/services/professions');
const {
  LISTING_TTL_SECONDS,
  createMarketplaceService,
} = require('../src/rpg/services/marketplace');
const {
  anonymousAlias,
  createEndgameService,
} = require('../src/rpg/services/endgame');
const {
  createSocialService,
} = require('../src/rpg/services/social');
const {
  loadRaids,
  publishRaids,
  periodFor,
  createRaidService,
} = require('../src/rpg/services/raids');

function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE rpg_users (
      telegram_user_id TEXT PRIMARY KEY,
      class_name TEXT NOT NULL DEFAULT 'ksatria',
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      gold INTEGER NOT NULL DEFAULT 0,
      hp INTEGER NOT NULL DEFAULT 50,
      max_hp INTEGER NOT NULL DEFAULT 50,
      atk INTEGER NOT NULL DEFAULT 10,
      def INTEGER NOT NULL DEFAULT 10,
      magic_atk INTEGER NOT NULL DEFAULT 0,
      crit_rate REAL NOT NULL DEFAULT 0.05,
      crit_multi REAL NOT NULL DEFAULT 1.5,
      updated_at INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE rpg_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_user_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      upgrade_tier INTEGER NOT NULL DEFAULT 0,
      equipped INTEGER NOT NULL DEFAULT 0,
      UNIQUE(telegram_user_id, item_id)
    );
    CREATE TABLE items_catalog (
      item_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      category TEXT NOT NULL,
      rarity TEXT NOT NULL,
      sell_price INTEGER NOT NULL DEFAULT 0,
      effect_json TEXT
    );
    INSERT INTO rpg_users (telegram_user_id, class_name, level, gold)
    VALUES ('1', 'ksatria', 1, 1000);
    INSERT INTO rpg_users (telegram_user_id, class_name, level, gold)
    VALUES ('2', 'penyihir', 1, 1000);
    INSERT INTO items_catalog (item_id, display_name, category, rarity, sell_price)
    VALUES ('tembaga', 'Tembaga', 'material', 'common', 8);
    INSERT INTO items_catalog (item_id, display_name, category, rarity, sell_price)
    VALUES ('fragmen_naga', 'Fragmen Naga', 'material', 'legendary', 0);
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
  assert.deepEqual(versions, [
    { version: 1 }, { version: 2 }, { version: 3 }, { version: 4 }, { version: 5 },
    { version: 6 },
    { version: 7 },
    { version: 8 },
    { version: 9 },
    { version: 10 },
  ]);
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

test('long dungeon validates content and persists every room checkpoint', () => {
  const db = createTestDb();
  const definitions = loadDungeons();
  publishDungeons(db, definitions);
  const dungeon = createLongDungeonService(db, { random: () => 1 });
  const started = dungeon.startSolo('1', 'goblin_ruins');
  assert.equal(started.success, true);
  const sessionId = started.session.id;
  const first = dungeon.advance('1', sessionId, 1, 'right');
  assert.equal(first.room.id, 'trap_hall');
  const stale = dungeon.advance('1', sessionId, 1, 'right');
  assert.equal(stale.success, false);
  const second = dungeon.advance('1', sessionId, 2, 'careful');
  assert.equal(second.room.id, 'hidden_cache');
  assert.equal(dungeon.getActive('1').state_version, 3);
  db.close();
});

test('long dungeon completion rewards are idempotent and include treasure', () => {
  const db = createTestDb();
  publishDungeons(db, loadDungeons());
  const dungeon = createLongDungeonService(db, { random: () => 1 });
  let session = dungeon.startSolo('1', 'goblin_ruins').session;
  const choices = ['right', 'careful', 'claim', 'rest', 'fight'];
  for (const choice of choices) {
    const result = dungeon.advance('1', session.id, session.state_version, choice);
    assert.equal(result.success, true);
    session = result.session;
  }
  assert.equal(session.status, 'completed');
  const user = db.prepare('SELECT level, xp, gold FROM rpg_users WHERE telegram_user_id = ?').get('1');
  assert.deepEqual(user, { level: 2, xp: 50, gold: 1067 });
  const inventory = db.prepare(
    'SELECT item_id, quantity FROM rpg_inventory WHERE telegram_user_id = ? ORDER BY item_id',
  ).all('1');
  assert.deepEqual(inventory, [
    { item_id: 'besi_rongsok', quantity: 2 },
    { item_id: 'ramuan_kecil', quantity: 1 },
  ]);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_dungeon_reward_claims').get().count, 1);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_currency_ledger').get().count, 1);
  db.close();
});

test('campaign events are idempotent and unlock the next quest', () => {
  const db = createTestDb();
  publishCampaign(db, loadCampaign());
  const campaign = createCampaignService(db);
  for (let index = 1; index <= 3; index++) {
    const result = campaign.recordEvent('1', {
      key: `explore:1:${index}`,
      type: 'explore',
      target: 'aldenmoor_outskirts',
      amount: 1,
    });
    assert.equal(result.processed, true);
  }
  const duplicate = campaign.recordEvent('1', {
    key: 'explore:1:3',
    type: 'explore',
    target: 'aldenmoor_outskirts',
    amount: 1,
  });
  assert.equal(duplicate.processed, false);
  const quests = campaign.list('1');
  assert.equal(quests.find(quest => quest.quest_id === 'chapter1_mist_clues').status, 'completed');
  assert.equal(quests.find(quest => quest.quest_id === 'chapter1_goblin_ruins').status, 'active');
  db.close();
});

test('campaign dungeon objective completes from a unique session event', () => {
  const db = createTestDb();
  publishCampaign(db, loadCampaign());
  const campaign = createCampaignService(db);
  campaign.recordEvent('1', {
    key: 'seed:explore',
    type: 'explore',
    target: 'aldenmoor_outskirts',
    amount: 3,
  });
  const result = campaign.recordEvent('1', {
    key: 'dungeon_complete:77:1',
    type: 'dungeon_complete',
    target: 'goblin_ruins',
    amount: 1,
  });
  assert.deepEqual(result.completed, ['chapter1_goblin_ruins']);
  db.close();
});

test('profession XP levels independently and rejects duplicate Telegram events', () => {
  const db = createTestDb();
  const professions = createProfessionService(db);
  const required = professionXpToNext(1);
  const first = professions.grantXp('1', 'mining', required + 5, 'telegram:100:mine');
  assert.equal(first.processed, true);
  assert.equal(first.level, 2);
  assert.equal(first.xp, 5);
  const duplicate = professions.grantXp('1', 'mining', 99, 'telegram:100:mine');
  assert.equal(duplicate.processed, false);
  const mining = professions.list('1').find(item => item.id === 'mining');
  assert.equal(mining.level, 2);
  assert.equal(mining.xp, 5);
  db.close();
});

test('marketplace escrows items and settles buyer, seller, tax atomically', () => {
  const db = createTestDb();
  db.prepare(`
    INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity)
    VALUES ('1', 'tembaga', 10)
  `).run();
  const market = createMarketplaceService(db);
  const listing = market.createListing('1', 'tembaga', 5, 10);
  assert.equal(listing.success, true);
  assert.equal(db.prepare(
    "SELECT quantity FROM rpg_inventory WHERE telegram_user_id='1' AND item_id='tembaga'",
  ).get().quantity, 5);
  const purchase = market.buy('2', listing.listingId);
  assert.equal(purchase.success, true);
  assert.equal(purchase.gross, 50);
  assert.equal(purchase.tax, 2);
  assert.equal(db.prepare("SELECT gold FROM rpg_users WHERE telegram_user_id='1'").get().gold, 1048);
  assert.equal(db.prepare("SELECT gold FROM rpg_users WHERE telegram_user_id='2'").get().gold, 950);
  assert.equal(db.prepare(
    "SELECT quantity FROM rpg_inventory WHERE telegram_user_id='2' AND item_id='tembaga'",
  ).get().quantity, 5);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_currency_ledger').get().count, 3);
  assert.equal(market.buy('2', listing.listingId).success, false);
  db.close();
});

test('market expiry returns escrow and bound items cannot be listed', () => {
  const db = createTestDb();
  db.prepare(`
    INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity)
    VALUES ('1', 'tembaga', 10), ('1', 'fragmen_naga', 1)
  `).run();
  let clock = 2_000_000_000;
  const market = createMarketplaceService(db, { now: () => clock });
  const listing = market.createListing('1', 'tembaga', 4, 10);
  assert.equal(listing.success, true);
  assert.equal(market.createListing('1', 'fragmen_naga', 1, 10).success, false);
  clock += LISTING_TTL_SECONDS + 1;
  assert.equal(market.expireListings(), 1);
  assert.equal(db.prepare(
    "SELECT quantity FROM rpg_inventory WHERE telegram_user_id='1' AND item_id='tembaga'",
  ).get().quantity, 10);
  assert.equal(db.prepare('SELECT status FROM rpg_market_listings WHERE id = ?').get(listing.listingId).status, 'expired');
  db.close();
});

test('season points are idempotent and leaderboard exposes only anonymous aliases', () => {
  const db = createTestDb();
  const endgame = createEndgameService(db, { now: () => 2_000_000_000 });
  assert.equal(endgame.addSeasonPoints('1', 25, 2, 'event:season:1').processed, true);
  assert.equal(endgame.addSeasonPoints('1', 25, 2, 'event:season:1').processed, false);
  const progress = endgame.getProgress('1').progress;
  assert.equal(progress.points, 25);
  assert.equal(progress.currency, 2);
  const rank = endgame.leaderboard(10)[0];
  assert.equal(rank.points, 25);
  assert.equal(rank.alias, anonymousAlias('1'));
  assert.match(rank.alias, /^Petualang-[A-F0-9]{6}$/);
  assert.notEqual(rank.alias, '1');
  db.close();
});

test('tower rewards, cooldown, and floor progress are persistent', () => {
  const db = createTestDb();
  let clock = 2_000_000_000;
  const endgame = createEndgameService(db, { now: () => clock, random: () => 1 });
  const first = endgame.attemptTower('1');
  assert.equal(first.success, true);
  assert.equal(first.win, true);
  assert.equal(first.floor, 1);
  assert.equal(endgame.getTower('1').best_floor, 1);
  assert.equal(endgame.attemptTower('1').success, false);
  clock += 61;
  assert.equal(endgame.attemptTower('1').floor, 2);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_currency_ledger').get().count, 2);
  assert.equal(endgame.getProgress('1').progress.points, 23);
  db.close();
});

test('achievements and item collection derive from persistent game state', () => {
  const db = createTestDb();
  const endgame = createEndgameService(db);
  endgame.getTower('1');
  db.prepare("UPDATE rpg_tower_progress SET best_floor = 10 WHERE user_id = '1'").run();
  db.prepare(`
    INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity)
    VALUES ('1', 'tembaga', 1)
  `).run();
  const achievements = endgame.listAchievements('1');
  assert.equal(achievements.find(item => item.id === 'tower_10').unlocked, true);
  assert.deepEqual(endgame.collection('1'), { owned: 1, total: 2, percent: 50 });
  db.close();
});

test('persistent party invite, membership, and owner transfer are atomic', () => {
  const db = createTestDb();
  const social = createSocialService(db, { now: () => 2_000_000_000 });
  const created = social.createParty('1');
  assert.equal(created.success, true);
  assert.equal(social.invite('1', '2').success, true);
  assert.equal(social.acceptInvite('2').success, true);
  assert.equal(social.getParty('1').members.length, 2);
  assert.equal(social.leaveParty('1').success, true);
  const transferred = social.getParty('2');
  assert.equal(transferred.owner_id, '2');
  assert.equal(transferred.members[0].role, 'owner');
  db.close();
});

test('guild creation, anonymous aliases, joining, and contributions are persistent', () => {
  const db = createTestDb();
  const social = createSocialService(db, { now: () => 2_000_000_000 });
  assert.equal(social.setAlias('1', 'RyuKnight').success, true);
  assert.equal(social.setAlias('2', 'MoonMage').success, true);
  const created = social.createGuild('1', 'RYU', 'Ryu Adventurers');
  assert.equal(created.success, true);
  assert.equal(social.joinGuild('2', 'RYU').success, true);
  assert.equal(social.contribute('2', 100).success, true);
  const guild = social.getGuild('2');
  assert.equal(guild.treasury, 100);
  assert.equal(guild.members.find(member => member.user_id === '1').alias, 'RyuKnight');
  assert.equal(guild.members.find(member => member.user_id === '2').contribution, 100);
  assert.equal(db.prepare("SELECT gold FROM rpg_users WHERE telegram_user_id='2'").get().gold, 900);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_currency_ledger').get().count, 2);
  db.close();
});

test('raid periods are stable for daily and weekly instances', () => {
  const timestamp = Math.floor(Date.parse('2026-07-23T12:00:00Z') / 1000);
  assert.equal(periodFor(timestamp, 'daily').key, '2026-07-23');
  assert.equal(periodFor(timestamp, 'weekly').key, '2026-07-20');
});

test('world boss damage is persistent and duplicate Telegram attacks are rejected', () => {
  const db = createTestDb();
  publishRaids(db, loadRaids(), 2_000_000_000);
  const raids = createRaidService(db, { now: () => 2_000_000_000, random: () => 0 });
  const first = raids.attack('1', 'world', 'telegram:1:100:world');
  assert.equal(first.success, true);
  assert.equal(first.damage > 0, true);
  const duplicate = raids.attack('1', 'world', 'telegram:1:100:world');
  assert.equal(duplicate.success, false);
  assert.equal(raids.getInstance('1', 'world').contribution.attempts, 1);
  db.close();
});

test('weekly party raid requires a duo and rewards can only be claimed once', () => {
  const db = createTestDb();
  const payload = loadRaids();
  payload.raids.find(raid => raid.type === 'party').maxHp = 1;
  publishRaids(db, payload, 2_000_000_000);
  const raids = createRaidService(db, { now: () => 2_000_000_000, random: () => 0 });
  assert.equal(raids.getInstance('1', 'party').success, false);
  const social = createSocialService(db, { now: () => 2_000_000_000 });
  social.createParty('1');
  social.invite('1', '2');
  social.acceptInvite('2');
  db.prepare("UPDATE rpg_users SET level=3 WHERE telegram_user_id IN ('1','2')").run();
  const attack = raids.attack('1', 'party', 'telegram:1:101:party');
  assert.equal(attack.success, true);
  assert.equal(attack.instance.status, 'defeated');
  const claim = raids.claim('1', 'party');
  assert.equal(claim.success, true);
  assert.equal(raids.claim('1', 'party').success, false);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_raid_reward_claims').get().count, 1);
  assert.equal(db.prepare('SELECT count(1) count FROM rpg_currency_ledger').get().count, 1);
  db.close();
});
