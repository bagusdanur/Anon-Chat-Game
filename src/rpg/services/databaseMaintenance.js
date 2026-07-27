const fs = require('fs');
const path = require('path');

function quoteSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getBackupDirectory(dbPath) {
  return path.join(path.dirname(dbPath), 'backups');
}

function pruneBackups(directory, keep = 14) {
  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith('.db'))
    .map(file => ({ file, time: fs.statSync(path.join(directory, file)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  files.slice(keep).forEach(({ file }) => fs.unlinkSync(path.join(directory, file)));
}

function createDatabaseBackup(db, dbPath, prefix = 'scheduled') {
  if (!dbPath || dbPath === ':memory:' || !fs.existsSync(dbPath)) {
    throw new Error('Database file tidak tersedia untuk backup.');
  }
  const directory = getBackupDirectory(dbPath);
  fs.mkdirSync(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(directory, `${prefix}-${stamp}.db`);
  // VACUUM INTO creates a coherent snapshot while WAL is active; copying bot.db
  // directly can otherwise omit uncheckpointed writes.
  db.exec(`VACUUM INTO ${quoteSql(target)}`);
  pruneBackups(directory);
  return target;
}

function getDatabaseHealth(db, dbPath) {
  const integrity = db.pragma('integrity_check', { simple: true });
  const directory = dbPath && dbPath !== ':memory:' ? getBackupDirectory(dbPath) : null;
  const latestBackup = directory && fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(file => file.endsWith('.db')).map(file => {
      const fullPath = path.join(directory, file);
      return { file, mtime: fs.statSync(fullPath).mtimeMs, size: fs.statSync(fullPath).size };
    }).sort((a, b) => b.mtime - a.mtime)[0] || null
    : null;
  return {
    integrity: String(integrity).toLowerCase() === 'ok' ? 'ok' : String(integrity),
    journalMode: db.pragma('journal_mode', { simple: true }),
    synchronous: db.pragma('synchronous', { simple: true }),
    foreignKeys: Boolean(db.pragma('foreign_keys', { simple: true })),
    busyTimeoutMs: Number(db.pragma('busy_timeout', { simple: true })),
    databaseBytes: dbPath && fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0,
    latestBackup,
  };
}

function startDatabaseMaintenance(db, dbPath, logger = console) {
  const run = () => {
    try {
      const backup = createDatabaseBackup(db, dbPath);
      const health = getDatabaseHealth(db, dbPath);
      logger.info?.({ backup, integrity: health.integrity }, 'Database maintenance completed');
    } catch (error) {
      logger.error?.({ err: error }, 'Database maintenance failed');
    }
  };
  const timer = setInterval(run, 24 * 60 * 60 * 1000);
  timer.unref();
  return { run, stop: () => clearInterval(timer) };
}

module.exports = { createDatabaseBackup, getDatabaseHealth, startDatabaseMaintenance };
