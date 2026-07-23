const crypto = require('crypto');
const { createLedgerService } = require('./ledger');
const { createEquipmentService } = require('./equipment');

const SEASON_DURATION_SECONDS = 70 * 24 * 60 * 60;
const TOWER_COOLDOWN_SECONDS = 60;

const ACHIEVEMENTS = [
  { id: 'first_dungeon', name: '🏰 Penakluk Pertama', description: 'Selesaikan satu dungeon panjang.' },
  { id: 'market_trader', name: '🏪 Pedagang', description: 'Selesaikan satu penjualan marketplace.' },
  { id: 'profession_apprentice', name: '🧰 Apprentice', description: 'Capai level 5 pada satu profession.' },
  { id: 'tower_10', name: '🗼 Pendaki', description: 'Capai lantai 10 Endless Tower.' },
];

function anonymousAlias(userId, salt = process.env.SEASON_ALIAS_SALT || 'anon-rpg-season') {
  const code = crypto.createHash('sha256').update(`${salt}:${userId}`).digest('hex').slice(0, 6).toUpperCase();
  return `Petualang-${code}`;
}

function createEndgameService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const random = options.random || Math.random;
  const ledger = createLedgerService(db);
  const equipment = createEquipmentService(db, { now, random });

  function getActiveSeason() {
    const timestamp = now();
    db.prepare("UPDATE rpg_seasons SET status = 'ended' WHERE status = 'active' AND ends_at <= ?")
      .run(timestamp);
    let season = db.prepare(`
      SELECT * FROM rpg_seasons WHERE status = 'active' AND starts_at <= ? AND ends_at > ?
      ORDER BY starts_at DESC LIMIT 1
    `).get(timestamp, timestamp);
    if (!season) {
      const id = `preseason-${new Date(timestamp * 1000).toISOString().slice(0, 10)}`;
      db.prepare(`
        INSERT OR IGNORE INTO rpg_seasons
          (season_id, name, starts_at, ends_at, status, modifiers_json, created_at)
        VALUES (?, 'Preseason Aldenmoor', ?, ?, 'active', '{"tower_points":1}', ?)
      `).run(id, timestamp, timestamp + SEASON_DURATION_SECONDS, timestamp);
      season = db.prepare('SELECT * FROM rpg_seasons WHERE season_id = ?').get(id);
    }
    return season;
  }

  function addSeasonPoints(userId, points, currency, eventKey) {
    const season = getActiveSeason();
    return db.transaction(() => {
      const receipt = db.prepare(`
        INSERT OR IGNORE INTO rpg_season_events
          (event_key, season_id, user_id, points, currency, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(eventKey, season.season_id, String(userId), points, currency, now());
      if (receipt.changes === 0) return { processed: false, season };
      db.prepare(`
        INSERT INTO rpg_season_progress (season_id, user_id, points, currency, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(season_id, user_id) DO UPDATE SET
          points = points + excluded.points,
          currency = currency + excluded.currency,
          updated_at = excluded.updated_at
      `).run(season.season_id, String(userId), points, currency, now());
      return { processed: true, season };
    })();
  }

  return {
    getActiveSeason,
    addSeasonPoints,
    getProgress(userId) {
      const season = getActiveSeason();
      const progress = db.prepare(`
        SELECT * FROM rpg_season_progress WHERE season_id = ? AND user_id = ?
      `).get(season.season_id, String(userId)) || {
        season_id: season.season_id, user_id: String(userId), points: 0, currency: 0,
      };
      return { season, progress };
    },
    leaderboard(limit = 10) {
      const season = getActiveSeason();
      return db.prepare(`
        SELECT user_id, points, currency
        FROM rpg_season_progress WHERE season_id = ?
        ORDER BY points DESC, updated_at ASC LIMIT ?
      `).all(season.season_id, Math.min(Math.max(limit, 1), 50))
        .map((row, index) => ({ rank: index + 1, alias: anonymousAlias(row.user_id), ...row }));
    },
    getTower(userId) {
      db.prepare(`
        INSERT OR IGNORE INTO rpg_tower_progress
          (user_id, best_floor, attempts, wins, updated_at)
        VALUES (?, 0, 0, 0, ?)
      `).run(String(userId), now());
      return db.prepare('SELECT * FROM rpg_tower_progress WHERE user_id = ?').get(String(userId));
    },
    attemptTower(userId) {
      const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(String(userId));
      if (!user) return { success: false, reason: 'Karakter tidak ditemukan.' };
      const tower = this.getTower(userId);
      const remaining = tower.last_attempt_at
        ? Math.max(0, TOWER_COOLDOWN_SECONDS - (now() - tower.last_attempt_at))
        : 0;
      if (remaining > 0) return { success: false, reason: `Tunggu ${remaining} detik.`, remaining };
      const floor = tower.best_floor + 1;
      const bonus = equipment.bonuses(userId);
      const playerPower = user.atk + (bonus.atk || 0) +
        user.def + (bonus.def || 0) +
        (user.magic_atk || 0) + (bonus.magic_atk || 0) +
        (bonus.max_hp || 0) * 0.1 + user.level * 2;
      const enemyPower = 12 + floor * 4;
      const win = playerPower * (0.85 + random() * 0.3) >= enemyPower;
      const timestamp = now();
      const gold = win ? 5 + floor * 2 : 0;
      db.transaction(() => {
        db.prepare(`
          UPDATE rpg_tower_progress SET
            best_floor = CASE WHEN ? THEN MAX(best_floor, ?) ELSE best_floor END,
            attempts = attempts + 1,
            wins = wins + CASE WHEN ? THEN 1 ELSE 0 END,
            last_attempt_at = ?, updated_at = ?
          WHERE user_id = ?
        `).run(win ? 1 : 0, floor, win ? 1 : 0, timestamp, timestamp, String(userId));
        if (win) {
          db.prepare('UPDATE rpg_users SET gold = MIN(50000, gold + ?), updated_at = ? WHERE telegram_user_id = ?')
            .run(gold, timestamp, String(userId));
          const balance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(String(userId)).gold;
          ledger.record({
            entryKey: `tower:${userId}:${floor}`,
            userId, amount: gold, balanceAfter: balance, reason: 'tower_reward',
            referenceType: 'tower_floor', referenceId: floor,
          });
          addSeasonPoints(userId, 10 + floor, 1, `tower:${userId}:${floor}`);
        }
      })();
      return { success: true, win, floor, gold, playerPower, enemyPower };
    },
    syncAchievements(userId) {
      const uid = String(userId);
      const conditions = {
        first_dungeon: db.prepare(
          "SELECT count(1) count FROM rpg_dungeon_sessions_v2 WHERE owner_id = ? AND status = 'completed'",
        ).get(uid).count > 0,
        market_trader: db.prepare(
          'SELECT count(1) count FROM rpg_market_sales WHERE seller_id = ?',
        ).get(uid).count > 0,
        profession_apprentice: db.prepare(
          'SELECT count(1) count FROM rpg_professions WHERE user_id = ? AND level >= 5',
        ).get(uid).count > 0,
        tower_10: this.getTower(uid).best_floor >= 10,
      };
      const unlocked = [];
      for (const achievement of ACHIEVEMENTS) {
        if (!conditions[achievement.id]) continue;
        const result = db.prepare(`
          INSERT OR IGNORE INTO rpg_achievement_unlocks (user_id, achievement_id, unlocked_at)
          VALUES (?, ?, ?)
        `).run(uid, achievement.id, now());
        if (result.changes) unlocked.push(achievement.id);
      }
      return unlocked;
    },
    listAchievements(userId) {
      this.syncAchievements(userId);
      const unlocked = new Set(db.prepare(
        'SELECT achievement_id FROM rpg_achievement_unlocks WHERE user_id = ?',
      ).all(String(userId)).map(row => row.achievement_id));
      return ACHIEVEMENTS.map(item => ({ ...item, unlocked: unlocked.has(item.id) }));
    },
    collection(userId) {
      const total = db.prepare('SELECT count(1) count FROM items_catalog').get().count;
      const owned = db.prepare(`
        SELECT count(DISTINCT item_id) count FROM rpg_inventory
        WHERE telegram_user_id = ? AND quantity > 0
      `).get(String(userId)).count;
      return { owned, total, percent: total ? Math.floor((owned / total) * 100) : 0 };
    },
  };
}

module.exports = {
  ACHIEVEMENTS,
  SEASON_DURATION_SECONDS,
  TOWER_COOLDOWN_SECONDS,
  anonymousAlias,
  createEndgameService,
};
