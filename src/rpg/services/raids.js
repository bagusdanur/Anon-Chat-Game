const fs = require('fs');
const path = require('path');
const { createLedgerService } = require('./ledger');
const { createEndgameService } = require('./endgame');
const { createEquipmentService } = require('./equipment');

const RAID_FILE = path.join(__dirname, '../../../data/rpg_raids.json');

function loadRaids(filePath = RAID_FILE) {
  const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Number.isInteger(payload.version) || !Array.isArray(payload.raids)) {
    throw new Error('Format content raid tidak valid.');
  }
  const ids = new Set();
  for (const raid of payload.raids) {
    if (!/^[a-z0-9_]+$/.test(raid.id) || ids.has(raid.id)) throw new Error(`Raid ID tidak valid: ${raid.id}`);
    if (!['world', 'party'].includes(raid.type)) throw new Error(`Tipe raid tidak valid: ${raid.id}`);
    if (!Number.isInteger(raid.maxHp) || raid.maxHp <= 0) throw new Error(`HP raid tidak valid: ${raid.id}`);
    if (!['daily', 'weekly'].includes(raid.duration)) throw new Error(`Durasi raid tidak valid: ${raid.id}`);
    ids.add(raid.id);
  }
  return payload;
}

function publishRaids(db, payload, timestamp = Math.floor(Date.now() / 1000)) {
  const statement = db.prepare(`
    INSERT INTO rpg_raid_definitions
      (raid_id, name, raid_type, definition_json, published, content_version, updated_at)
    VALUES (?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(raid_id) DO UPDATE SET name=excluded.name, raid_type=excluded.raid_type,
      definition_json=excluded.definition_json, published=1,
      content_version=excluded.content_version, updated_at=excluded.updated_at
  `);
  db.transaction(() => {
    for (const raid of payload.raids) {
      statement.run(raid.id, raid.name, raid.type, JSON.stringify(raid), payload.version, timestamp);
    }
  })();
}

function periodFor(timestamp, duration) {
  const date = new Date(timestamp * 1000);
  if (duration === 'daily') {
    const key = date.toISOString().slice(0, 10);
    const start = Math.floor(Date.parse(`${key}T00:00:00.000Z`) / 1000);
    return { key, start, end: start + 86400 };
  }
  const day = date.getUTCDay() || 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1));
  const start = Math.floor(monday.getTime() / 1000);
  return { key: monday.toISOString().slice(0, 10), start, end: start + (7 * 86400) };
}

function createRaidService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const random = options.random || Math.random;
  const ledger = createLedgerService(db);
  const endgame = createEndgameService(db, { now, random });
  const equipment = createEquipmentService(db, { now, random });

  function definition(type) {
    const row = db.prepare(`
      SELECT * FROM rpg_raid_definitions WHERE raid_type = ? AND published = 1
      ORDER BY content_version DESC LIMIT 1
    `).get(type);
    if (!row) throw new Error(`Content ${type} raid belum dipublish.`);
    return JSON.parse(row.definition_json);
  }

  function scopeFor(userId, type) {
    if (type === 'world') return { success: true, key: 'global' };
    const party = db.prepare(`
      SELECT p.id, (SELECT count(1) FROM rpg_party_members WHERE party_id=p.id) member_count
      FROM rpg_parties p JOIN rpg_party_members m ON m.party_id=p.id
      WHERE m.user_id=? AND p.status='active'
    `).get(String(userId));
    if (!party || party.member_count < 2) return { success: false, reason: 'Weekly raid memerlukan party minimal 2 pemain.' };
    return { success: true, key: `party:${party.id}`, partyId: party.id };
  }

  function getInstance(userId, type) {
    const raid = definition(type);
    const scope = scopeFor(userId, type);
    if (!scope.success) return scope;
    const period = periodFor(now(), raid.duration);
    db.prepare(`
      INSERT OR IGNORE INTO rpg_raid_instances
        (raid_id, period_key, scope_key, max_hp, current_hp, starts_at, ends_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(raid.id, period.key, scope.key, raid.maxHp, raid.maxHp, period.start, period.end, now());
    const instance = db.prepare(`
      SELECT * FROM rpg_raid_instances WHERE raid_id=? AND period_key=? AND scope_key=?
    `).get(raid.id, period.key, scope.key);
    const contribution = db.prepare(`
      SELECT count(1) attempts, coalesce(sum(damage),0) damage
      FROM rpg_raid_contributions WHERE instance_id=? AND user_id=?
    `).get(instance.id, String(userId));
    return { success: true, raid, instance, contribution };
  }

  function attack(userId, type, eventKey) {
    const state = getInstance(userId, type);
    if (!state.success) return state;
    const { raid, instance, contribution } = state;
    if (instance.status !== 'active' || instance.ends_at <= now()) return { success: false, reason: 'Raid sudah berakhir.' };
    if (contribution.attempts >= raid.attemptLimit) return { success: false, reason: 'Batas serangan periode ini sudah habis.' };
    const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
    if (!user || user.level < raid.minLevel) return { success: false, reason: `Minimal level ${raid.minLevel}.` };
    const bonus = equipment.bonuses(userId);
    const damage = Math.max(1, Math.floor(
      (user.atk + (bonus.atk || 0)) * 2 +
      (user.magic_atk + (bonus.magic_atk || 0)) * 1.8 +
      (user.def + (bonus.def || 0)) * 0.5 + user.level * 4 + random() * 12,
    ));
    return db.transaction(() => {
      const receipt = db.prepare(`
        INSERT OR IGNORE INTO rpg_raid_contributions
          (event_key, instance_id, user_id, damage, created_at) VALUES (?, ?, ?, ?, ?)
      `).run(String(eventKey), instance.id, String(userId), damage, now());
      if (receipt.changes === 0) return { success: false, reason: 'Serangan ini sudah diproses.' };
      db.prepare(`
        UPDATE rpg_raid_instances SET current_hp=max(0,current_hp-?),
          status=CASE WHEN current_hp-? <= 0 THEN 'defeated' ELSE status END,
          defeated_at=CASE WHEN current_hp-? <= 0 THEN ? ELSE defeated_at END
        WHERE id=? AND status='active'
      `).run(damage, damage, damage, now(), instance.id);
      return { success: true, damage, ...getInstance(userId, type) };
    })();
  }

  function claim(userId, type) {
    const state = getInstance(userId, type);
    if (!state.success) return state;
    const { raid, instance, contribution } = state;
    if (instance.status !== 'defeated') return { success: false, reason: 'Boss belum dikalahkan.' };
    if (contribution.damage <= 0) return { success: false, reason: 'Kamu belum berkontribusi.' };
    const reward = {
      gold: raid.baseGold + Math.min(raid.baseGold, Math.floor(contribution.damage / 10)),
      seasonPoints: raid.seasonPoints,
    };
    return db.transaction(() => {
      const inserted = db.prepare(`
        INSERT OR IGNORE INTO rpg_raid_reward_claims
          (instance_id,user_id,reward_json,claimed_at) VALUES (?,?,?,?)
      `).run(instance.id, String(userId), JSON.stringify(reward), now());
      if (inserted.changes === 0) return { success: false, reason: 'Reward sudah diklaim.' };
      db.prepare('UPDATE rpg_users SET gold=gold+?, updated_at=? WHERE telegram_user_id=?')
        .run(reward.gold, now(), String(userId));
      const balance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(String(userId)).gold;
      ledger.record({
        entryKey: `raid_reward:${instance.id}:${userId}`, userId, amount: reward.gold,
        balanceAfter: balance, reason: `${type}_raid_reward`,
        referenceType: 'raid', referenceId: instance.id,
      });
      endgame.addSeasonPoints(userId, reward.seasonPoints, 1, `raid_season:${instance.id}:${userId}`);
      return { success: true, reward };
    })();
  }

  function leaderboard(userId, type, limit = 10) {
    const state = getInstance(userId, type);
    if (!state.success) return state;
    const rows = db.prepare(`
      SELECT user_id, sum(damage) damage, count(1) attempts
      FROM rpg_raid_contributions WHERE instance_id=?
      GROUP BY user_id ORDER BY damage DESC LIMIT ?
    `).all(state.instance.id, limit);
    return { ...state, rows };
  }

  return { getInstance, attack, claim, leaderboard };
}

module.exports = { loadRaids, publishRaids, periodFor, createRaidService };
