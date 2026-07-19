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

// ===== PRECOMPILED SQL STATEMENTS (OPTIMASI KECEPATAN) =====
const stmtGetUser = db.prepare('SELECT * FROM users WHERE chat_id = ?');
const stmtInsertUser = db.prepare('INSERT INTO users (chat_id) VALUES (?)');
const stmtPairUsers = db.prepare('UPDATE users SET status = ?, partner_id = ? WHERE chat_id = ?');
const stmtUnpairUser = db.prepare('UPDATE users SET status = ?, partner_id = NULL WHERE chat_id = ?');
const stmtEnqueueUser = db.prepare('UPDATE users SET status = ?, partner_id = NULL WHERE chat_id = ?');
const stmtDequeueUser = db.prepare('UPDATE users SET status = ?, partner_id = NULL WHERE chat_id = ?');
const stmtFirstMatchLang = db.prepare(`
  SELECT chat_id FROM users 
  WHERE status = 'queued' 
    AND chat_id != ? 
    AND is_banned = 0 
    AND (lang = ? OR lang = 'any' OR ? = 'any')
    AND (gender = ? OR ? = 'any')
    AND (match_gender = ? OR match_gender = 'any')
  ORDER BY created_at ASC LIMIT 1
`);
const stmtFirstMatchAny = db.prepare(`
  SELECT chat_id FROM users 
  WHERE status = 'queued' 
    AND chat_id != ? 
    AND is_banned = 0 
    AND (gender = ? OR ? = 'any')
    AND (match_gender = ? OR match_gender = 'any')
  ORDER BY created_at ASC LIMIT 1
`);
const stmtSetLang = db.prepare('UPDATE users SET lang = ? WHERE chat_id = ?');
const stmtSetGender = db.prepare('UPDATE users SET gender = ? WHERE chat_id = ?');
const stmtSetMatchGender = db.prepare('UPDATE users SET match_gender = ? WHERE chat_id = ?');
const stmtGetAllUserIds = db.prepare('SELECT chat_id FROM users');
const stmtInsertReport = db.prepare('INSERT INTO reports (reporter_id, reported_id, reason) VALUES (?, ?, ?)');
const stmtBanUser = db.prepare('UPDATE users SET is_banned = 1 WHERE chat_id = ?');
const stmtUnbanUser = db.prepare('UPDATE users SET is_banned = 0 WHERE chat_id = ?');

// ===== IN-MEMORY RAM CACHE =====
// Menyimpan ID partner di RAM supaya relay pesan 0ms tanpa hit database
const partnerCache = new Map();

function getUser(chatId) {
  let user = stmtGetUser.get(chatId);
  if (!user) {
    stmtInsertUser.run(chatId);
    user = stmtGetUser.get(chatId);
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
  const cached = partnerCache.get(chatId.toString());
  if (cached !== undefined) return cached;
  const user = getUser(chatId);
  if (user && user.status === 'chatting' && user.partner_id) {
    partnerCache.set(chatId.toString(), user.partner_id);
    return user.partner_id;
  }
  partnerCache.set(chatId.toString(), null);
  return null;
}

function pairUsers(chatIdA, chatIdB) {
  const transaction = db.transaction(() => {
    stmtPairUsers.run('chatting', chatIdB, chatIdA);
    stmtPairUsers.run('chatting', chatIdA, chatIdB);
  });
  transaction();
  partnerCache.set(chatIdA.toString(), chatIdB);
  partnerCache.set(chatIdB.toString(), chatIdA);
}

function unpairUser(chatId) {
  const partnerId = getPartnerId(chatId);
  if (partnerId) {
    const transaction = db.transaction(() => {
      stmtUnpairUser.run('idle', chatId);
      stmtUnpairUser.run('idle', partnerId);
    });
    transaction();
    partnerCache.delete(chatId.toString());
    partnerCache.delete(partnerId.toString());
  } else {
    partnerCache.delete(chatId.toString());
  }
  return partnerId;
}

function enqueueUser(chatId) {
  stmtEnqueueUser.run('queued', chatId);
  partnerCache.delete(chatId.toString());
}

function dequeueUser(chatId) {
  stmtDequeueUser.run('idle', chatId);
  partnerCache.delete(chatId.toString());
}

function getFirstQueuedExcluding(chatId) {
  const user = getUser(chatId);
  const userLang = user.lang || 'any';
  const userGender = user.gender || 'any';
  const userMatchGender = user.match_gender || 'any';
  
  let match = stmtFirstMatchLang.get(chatId, userLang, userLang, userMatchGender, userMatchGender, userGender);
  if (!match) {
    match = stmtFirstMatchAny.get(chatId, userMatchGender, userMatchGender, userGender);
  }
  return match ? match.chat_id : null;
}

function setLang(chatId, lang) {
  stmtSetLang.run(lang, chatId);
}

function setGender(chatId, gender) {
  stmtSetGender.run(gender, chatId);
}

function setMatchGender(chatId, matchGender) {
  stmtSetMatchGender.run(matchGender, chatId);
}

function getAllUserIds() {
  const users = stmtGetAllUserIds.all();
  return users.map(u => u.chat_id);
}

function reportUser(reporterId, reason = '') {
  const reportedId = getPartnerId(reporterId);
  if (!reportedId) return false;
  stmtInsertReport.run(reporterId, reportedId, reason);
  return true;
}

function banUser(chatId) {
  stmtBanUser.run(chatId);
  partnerCache.delete(chatId.toString());
}

function unbanUser(chatId) {
  stmtUnbanUser.run(chatId);
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
