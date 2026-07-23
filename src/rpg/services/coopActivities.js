const { createLedgerService } = require('./ledger');
const { createEndgameService } = require('./endgame');
const { createEquipmentService } = require('./equipment');

const BOUNTY_TARGET = 100;
const BOUNTY_ACTION_LIMIT = 3;

function dailyPeriod(timestamp) {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function createCoopActivityService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const random = options.random || Math.random;
  const ledger = createLedgerService(db);
  const endgame = createEndgameService(db, { now, random });
  const equipment = createEquipmentService(db, { now, random });

  function partyFor(userId) {
    const party = db.prepare(`
      SELECT p.*, (SELECT count(1) FROM rpg_party_members WHERE party_id=p.id) member_count
      FROM rpg_parties p JOIN rpg_party_members m ON m.party_id=p.id
      WHERE m.user_id=? AND p.status='active'
    `).get(String(userId));
    if (!party || party.member_count < 2) return null;
    return party;
  }

  function getBounty(userId) {
    const party = partyFor(userId);
    if (!party) return { success: false, reason: 'Duo bounty memerlukan party minimal 2 pemain.' };
    const period = dailyPeriod(now());
    db.prepare(`
      INSERT OR IGNORE INTO rpg_duo_bounties
        (party_id,period_key,target,created_at) VALUES (?,?,?,?)
    `).run(party.id, period, BOUNTY_TARGET, now());
    const bounty = db.prepare('SELECT * FROM rpg_duo_bounties WHERE party_id=? AND period_key=?')
      .get(party.id, period);
    const personal = db.prepare(`
      SELECT count(1) actions,coalesce(sum(amount),0) contribution
      FROM rpg_duo_bounty_actions WHERE bounty_id=? AND user_id=?
    `).get(bounty.id, String(userId));
    return { success: true, party, bounty, personal };
  }

  function act(userId, eventKey) {
    const state = getBounty(userId);
    if (!state.success) return state;
    if (state.bounty.status !== 'active') return { success: false, reason: 'Bounty hari ini sudah selesai.' };
    if (state.personal.actions >= BOUNTY_ACTION_LIMIT) return { success: false, reason: 'Batas aksi bounty hari ini sudah habis.' };
    const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
    const bonus = equipment.bonuses(userId);
    const amount = Math.max(1, Math.floor(
      user.atk + (bonus.atk || 0) + user.magic_atk + (bonus.magic_atk || 0) +
      user.level * 3 + random() * 8,
    ));
    return db.transaction(() => {
      const receipt = db.prepare(`
        INSERT OR IGNORE INTO rpg_duo_bounty_actions
          (event_key,bounty_id,user_id,amount,created_at) VALUES (?,?,?,?,?)
      `).run(String(eventKey), state.bounty.id, String(userId), amount, now());
      if (receipt.changes === 0) return { success: false, reason: 'Aksi ini sudah diproses.' };
      db.prepare(`
        UPDATE rpg_duo_bounties SET progress=min(target,progress+?),
          status=CASE WHEN progress+?>=target THEN 'completed' ELSE status END,
          completed_at=CASE WHEN progress+?>=target THEN ? ELSE completed_at END
        WHERE id=? AND status='active'
      `).run(amount, amount, amount, now(), state.bounty.id);
      return { success: true, amount, ...getBounty(userId) };
    })();
  }

  function claim(userId) {
    const state = getBounty(userId);
    if (!state.success) return state;
    if (state.bounty.status !== 'completed') return { success: false, reason: 'Target bounty belum tercapai.' };
    if (state.personal.actions === 0) return { success: false, reason: 'Kamu belum berkontribusi.' };
    const reward = { gold: 100 + state.personal.contribution, seasonPoints: 15 };
    return db.transaction(() => {
      const receipt = db.prepare(`
        INSERT OR IGNORE INTO rpg_duo_bounty_claims
          (bounty_id,user_id,reward_json,claimed_at) VALUES (?,?,?,?)
      `).run(state.bounty.id, String(userId), JSON.stringify(reward), now());
      if (receipt.changes === 0) return { success: false, reason: 'Reward sudah diklaim.' };
      db.prepare('UPDATE rpg_users SET gold=gold+?,updated_at=? WHERE telegram_user_id=?')
        .run(reward.gold, now(), String(userId));
      const balance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(String(userId)).gold;
      ledger.record({
        entryKey: `duo_bounty:${state.bounty.id}:${userId}`, userId, amount: reward.gold,
        balanceAfter: balance, reason: 'duo_bounty_reward',
        referenceType: 'duo_bounty', referenceId: state.bounty.id,
      });
      endgame.addSeasonPoints(userId, reward.seasonPoints, 1, `duo_bounty_season:${state.bounty.id}:${userId}`);
      return { success: true, reward };
    })();
  }

  return { partyFor, getBounty, act, claim };
}

module.exports = { BOUNTY_TARGET, BOUNTY_ACTION_LIMIT, dailyPeriod, createCoopActivityService };
