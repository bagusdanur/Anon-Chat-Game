const { db } = require('../src/db');

const GOLD_CAP = 50000;
const now = Math.floor(Date.now() / 1000);

const result = db.transaction(() => {
  const before = db.prepare(
    'SELECT COUNT(*) AS count, COALESCE(MAX(gold), 0) AS highest FROM rpg_users WHERE gold > ?',
  ).get(GOLD_CAP);
  const updated = db.prepare(
    'UPDATE rpg_users SET gold = ?, updated_at = ? WHERE gold > ?',
  ).run(GOLD_CAP, now, GOLD_CAP);
  const remaining = db.prepare(
    'SELECT COUNT(*) AS count FROM rpg_users WHERE gold > ?',
  ).get(GOLD_CAP).count;
  return {
    affectedPlayers: updated.changes,
    highestBefore: before.highest,
    remainingAboveCap: remaining,
  };
})();

console.log(JSON.stringify(result));
db.close();
