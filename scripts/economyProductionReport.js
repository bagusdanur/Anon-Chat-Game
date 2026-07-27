const path = require('path');
const Database = require('better-sqlite3');

const databasePath = path.resolve(process.argv[2] || path.join(__dirname, '../data/bot.db'));
const days = Math.max(1, Number(process.argv[3]) || 30);
const db = new Database(databasePath, { readonly: true, fileMustExist: true });
const since = Math.floor(Date.now() / 1000) - days * 86400;

const reasons = db.prepare(`
  SELECT reason, COUNT(*) entries, SUM(amount) total
  FROM rpg_currency_ledger
  WHERE created_at >= ?
  GROUP BY reason
  ORDER BY ABS(SUM(amount)) DESC
`).all(since);

const sources = reasons
  .filter(row => row.total > 0)
  .reduce((sum, row) => sum + row.total, 0);
const sinks = Math.abs(reasons
  .filter(row => row.total < 0)
  .reduce((sum, row) => sum + row.total, 0));
const balances = db.prepare(`
  SELECT COUNT(*) players, COALESCE(SUM(gold), 0) total_gold,
         COALESCE(AVG(gold), 0) average_gold, COALESCE(MAX(gold), 0) max_gold
  FROM rpg_users
`).get();
const cappedPlayers = db.prepare('SELECT COUNT(*) count FROM rpg_users WHERE gold >= 50000').get().count;
const legacy = db.prepare(`
  SELECT reason, COUNT(*) entries, SUM(amount) total
  FROM transactions_log
  WHERE created_at >= ?
  GROUP BY reason
  ORDER BY ABS(SUM(amount)) DESC
`).all(since);

process.stdout.write(`${JSON.stringify({
  databasePath,
  days,
  ledger: {
    sources,
    sinks,
    sourceSinkRatio: sinks ? Number((sources / sinks).toFixed(3)) : null,
    coverageWarning: 'Legacy gold paths may only exist in transactions_log until migrated.',
    reasons,
  },
  balances: {
    ...balances,
    average_gold: Math.round(balances.average_gold),
    capped_players: cappedPlayers,
  },
  legacyTransactions: legacy,
}, null, 2)}\n`);

db.close();
