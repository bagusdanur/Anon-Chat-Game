const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { runRpgMigrations } = require('../src/rpg/migrations');

async function main() {
  const sourcePath = path.resolve(process.argv[2] || process.env.DATABASE_PATH || './data/bot.db');
  const targetPath = path.resolve(process.argv[3] || `${sourcePath}.migration-dry-run`);
  if (!fs.existsSync(sourcePath)) throw new Error(`Database tidak ditemukan: ${sourcePath}`);
  if (fs.existsSync(targetPath)) throw new Error(`Target dry-run sudah ada: ${targetPath}`);

  const source = new Database(sourcePath, { readonly: true });
  await source.backup(targetPath);
  source.close();

  const copy = new Database(targetPath);
  copy.pragma('foreign_keys = ON');
  const before = {
    users: copy.prepare('SELECT count(1) count FROM rpg_users').get().count,
    gold: copy.prepare('SELECT coalesce(sum(gold),0) total FROM rpg_users').get().total,
    inventory: copy.prepare('SELECT coalesce(sum(quantity),0) total FROM rpg_inventory').get().total,
  };
  const result = runRpgMigrations(copy, { backup: false });
  const after = {
    users: copy.prepare('SELECT count(1) count FROM rpg_users').get().count,
    gold: copy.prepare('SELECT coalesce(sum(gold),0) total FROM rpg_users').get().total,
    inventory: copy.prepare('SELECT coalesce(sum(quantity),0) total FROM rpg_inventory').get().total,
  };
  const quickCheck = copy.pragma('quick_check', { simple: true });
  const latestVersion = copy.prepare(`
    SELECT max(version) version FROM schema_migrations WHERE scope='rpg'
  `).get().version;
  copy.close();

  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  const report = { sourcePath, targetPath, applied: result.applied, latestVersion, quickCheck, before, after, unchanged };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (quickCheck !== 'ok' || !unchanged) process.exitCode = 1;
}

main().catch(error => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
