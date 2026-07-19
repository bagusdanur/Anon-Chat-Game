const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'bot.db');
const db = new Database(dbPath);

// Aktifkan mode WAL & sinkronisasi optimal untuk performa dan keamanan data tinggi di VPS
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    chat_id INTEGER PRIMARY KEY,
    status TEXT DEFAULT 'idle',
    partner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_banned BOOLEAN DEFAULT 0,
    lang TEXT DEFAULT 'any'
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_id INTEGER,
    reported_id INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE users ADD COLUMN lang TEXT DEFAULT "any"');
} catch (e) {}
try {
  db.exec('ALTER TABLE users ADD COLUMN gender TEXT DEFAULT "any"');
} catch (e) {}
try {
  db.exec('ALTER TABLE users ADD COLUMN match_gender TEXT DEFAULT "any"');
} catch (e) {}

function getUser(chatId) {
  let user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
  if (!user) {
    db.prepare('INSERT INTO users (chat_id) VALUES (?)').run(chatId);
    user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(chatId);
  }
  return user;
}

function isPaired(chatId) {
  return getUser(chatId).status === 'chatting';
}

function isQueued(chatId) {
  return getUser(chatId).status === 'queued';
}

function getPartnerId(chatId) {
  return getUser(chatId).partner_id;
}

function pairUsers(chatIdA, chatIdB) {
  const stmt = db.prepare('UPDATE users SET status = ?, partner_id = ? WHERE chat_id = ?');
  const transaction = db.transaction(() => {
    stmt.run('chatting', chatIdB, chatIdA);
    stmt.run('chatting', chatIdA, chatIdB);
  });
  transaction();
}

function unpairUser(chatId) {
  const partnerId = getPartnerId(chatId);
  if (partnerId) {
    const stmt = db.prepare('UPDATE users SET status = ?, partner_id = NULL WHERE chat_id = ?');
    const transaction = db.transaction(() => {
      stmt.run('idle', chatId);
      stmt.run('idle', partnerId);
    });
    transaction();
  }
  return partnerId;
}

function enqueueUser(chatId) {
  db.prepare('UPDATE users SET status = ?, partner_id = NULL WHERE chat_id = ?').run('queued', chatId);
}

function dequeueUser(chatId) {
  db.prepare('UPDATE users SET status = ?, partner_id = NULL WHERE chat_id = ?').run('idle', chatId);
}

function getFirstQueuedExcluding(chatId) {
  const user = getUser(chatId);
  const userLang = user.lang || 'any';
  const userGender = user.gender || 'any';
  const userMatchGender = user.match_gender || 'any';
  
  let match = db.prepare(`
    SELECT chat_id FROM users 
    WHERE status = 'queued' 
      AND chat_id != ? 
      AND is_banned = 0 
      AND (lang = ? OR lang = 'any' OR ? = 'any')
      AND (gender = ? OR ? = 'any')
      AND (match_gender = ? OR match_gender = 'any')
    ORDER BY created_at ASC LIMIT 1
  `).get(chatId, userLang, userLang, userMatchGender, userMatchGender, userGender);
  
  if (!match) {
    match = db.prepare(`
      SELECT chat_id FROM users 
      WHERE status = 'queued' 
        AND chat_id != ? 
        AND is_banned = 0 
        AND (gender = ? OR ? = 'any')
        AND (match_gender = ? OR match_gender = 'any')
      ORDER BY created_at ASC LIMIT 1
    `).get(chatId, userMatchGender, userMatchGender, userGender);
  }
  
  return match ? match.chat_id : null;
}

function setLang(chatId, lang) {
  db.prepare('UPDATE users SET lang = ? WHERE chat_id = ?').run(lang, chatId);
}

function setGender(chatId, gender) {
  db.prepare('UPDATE users SET gender = ? WHERE chat_id = ?').run(gender, chatId);
}

function setMatchGender(chatId, matchGender) {
  db.prepare('UPDATE users SET match_gender = ? WHERE chat_id = ?').run(matchGender, chatId);
}

function getAllUserIds() {
  const users = db.prepare('SELECT chat_id FROM users').all();
  return users.map(u => u.chat_id);
}

function reportUser(reporterId, reason = '') {
  const reportedId = getPartnerId(reporterId);
  if (!reportedId) return false;
  db.prepare('INSERT INTO reports (reporter_id, reported_id, reason) VALUES (?, ?, ?)').run(reporterId, reportedId, reason);
  return true;
}

function banUser(chatId) {
  db.prepare('UPDATE users SET is_banned = 1 WHERE chat_id = ?').run(chatId);
}

function unbanUser(chatId) {
  db.prepare('UPDATE users SET is_banned = 0 WHERE chat_id = ?').run(chatId);
}

function isBanned(chatId) {
  return getUser(chatId).is_banned === 1;
}

module.exports = {
  db,
  getUser,
  isPaired,
  isQueued,
  getPartnerId,
  pairUsers,
  unpairUser,
  enqueueUser,
  dequeueUser,
  getFirstQueuedExcluding,
  reportUser,
  banUser,
  unbanUser,
  isBanned,
  setLang,
  setGender,
  setMatchGender,
  getAllUserIds
};
