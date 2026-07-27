require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pinoHttp = require('pino-http');
const Sentry = require('@sentry/node');
const { db } = require('./src/db');
const { createDatabaseBackup, getDatabaseHealth } = require('./src/rpg/services/databaseMaintenance');
const { getWords, FILTER_PATH } = require('./src/moderation/wordFilter');
const { getGameSettings, saveGameSettings } = require('./src/rpg/config');
const { createFeatureFlagService } = require('./src/rpg/services/featureFlags');
const { collectRpgTelemetry } = require('./src/rpg/services/telemetry');
const { getQuestions, JSON_PATH: ICEBREAKERS_JSON_PATH } = require('./src/icebreakers');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;
const PASSWORD = process.env.DASHBOARD_PASS || 'ryudev2024';
const featureFlags = createFeatureFlagService(db);
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data/bot.db');
const sentryEnabled = Boolean(process.env.SENTRY_DSN);
if (sentryEnabled) Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.05 });

// Password check helper
function checkAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [, password] = credentials.split(':');
  return password === PASSWORD;
}

// Static files — serve dist if exists, else dashboard
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(pinoHttp({ autoLogging: { ignore: req => req.url === '/api/health' } }));
app.use(express.json({ limit: '128kb' }));
app.use('/api', rateLimit({ windowMs: 60 * 1000, max: 240, standardHeaders: 'draft-8', legacyHeaders: false }));
const staticDir = fs.existsSync(path.join(__dirname, 'dist')) ? 'dist' : 'dashboard';
app.use(express.static(path.join(__dirname, staticDir)));

// Auth middleware
function auth(req, res, next) {
  if (checkAuth(req)) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

// ===== AUTH =====
app.get('/api/check-auth', (req, res) => {
  res.json({ authenticated: checkAuth(req) });
});

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'anon-dashboard', now: Date.now() }));

// ===== STATS =====
app.get('/api/stats', auth, (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const onlineUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status != 'idle'").get().count;
  const pairedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'chatting'").get().count;
  const queuedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'queued'").get().count;
  const bannedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_banned = 1").get().count;
  const reports24h = db.prepare("SELECT COUNT(*) as count FROM reports WHERE created_at >= datetime('now', '-1 day')").get().count;
  const rpgUsers = db.prepare('SELECT COUNT(*) as count FROM rpg_users').get().count;
  const totalReports = db.prepare('SELECT COUNT(*) as count FROM reports').get().count;
  const totalDungeonRuns = db.prepare('SELECT COUNT(*) as count FROM dungeon_runs').get().count;
  const totalDuels = db.prepare('SELECT COUNT(*) as count FROM duel_history').get().count;
  const totalTransactions = db.prepare('SELECT COUNT(*) as count FROM transactions_log').get().count;

  res.json({ totalUsers, onlineUsers, pairedUsers, queuedUsers, bannedUsers, reports24h, rpgUsers, totalReports, totalDungeonRuns, totalDuels, totalTransactions });
});

app.get('/api/stats/chart', auth, (req, res) => {
  // Get 7 days data for new users (created_at is DATETIME)
  const userStats = db.prepare(`
    SELECT DATE(created_at) as date, COUNT(*) as count 
    FROM users 
    WHERE created_at >= date('now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
  `).all();

  // Get 7 days data for transactions (created_at is INTEGER unix timestamp)
  const txStats = db.prepare(`
    SELECT DATE(created_at, 'unixepoch') as date, SUM(amount) as total 
    FROM transactions_log 
    WHERE created_at >= strftime('%s', 'now', '-7 days')
    GROUP BY date
    ORDER BY date ASC
  `).all();

  res.json({ users: userStats, transactions: txStats });
});

// ===== USER SEARCH =====
app.get('/api/users/search', auth, (req, res) => {
  const { q, status, banned, lang, gender } = req.query;
  let sql = 'SELECT * FROM users WHERE 1=1';
  const params = [];
  if (q) { sql += ' AND (chat_id LIKE ? OR lang LIKE ? OR gender LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (banned !== undefined) { sql += ' AND is_banned = ?'; params.push(banned === 'true' ? 1 : 0); }
  if (lang) { sql += ' AND lang = ?'; params.push(lang); }
  if (gender) { sql += ' AND LOWER(gender) = LOWER(?)'; params.push(gender); }
  sql += ' ORDER BY created_at DESC LIMIT 50';
  const users = db.prepare(sql).all(...params);
  res.json(users);
});

// ===== USERS =====
app.get('/api/users', auth, (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
  res.json(users);
});

app.get('/api/users/:id', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE chat_id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const rpg = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(req.params.id);
  const reports = db.prepare('SELECT * FROM reports WHERE reporter_id = ? OR reported_id = ? ORDER BY created_at DESC LIMIT 10').all(req.params.id, req.params.id);
  res.json({ user, rpg, reports });
});

app.post('/api/users/:id/ban', auth, (req, res) => {
  db.prepare('UPDATE users SET is_banned = 1 WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/users/:id/unban', auth, (req, res) => {
  db.prepare('UPDATE users SET is_banned = 0 WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/users/:id/reset', auth, (req, res) => {
  db.prepare("UPDATE users SET status = 'idle', partner_id = NULL WHERE chat_id = ?").run(req.params.id);
  res.json({ success: true });
});

app.delete('/api/users/:id', auth, (req, res) => {
  db.prepare('DELETE FROM users WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== RPG USERS =====
app.get('/api/rpg-users', auth, (req, res) => {
  const users = db.prepare('SELECT * FROM rpg_users ORDER BY level DESC LIMIT 50').all();
  res.json(users);
});

app.get('/api/rpg-users/:id', auth, (req, res) => {
  const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'RPG user not found' });
  const inventory = db.prepare(`
    SELECT i.*, c.display_name, c.category, c.rarity, c.effect_json
    FROM rpg_inventory i JOIN items_catalog c ON i.item_id = c.item_id
    WHERE i.telegram_user_id = ?
  `).all(req.params.id);
  const duels = db.prepare('SELECT * FROM duel_history WHERE player_a_id = ? OR player_b_id = ? ORDER BY started_at DESC LIMIT 10').all(req.params.id, req.params.id);
  const dungeons = db.prepare('SELECT * FROM dungeon_runs WHERE player_a_id = ? OR player_b_id = ? ORDER BY started_at DESC LIMIT 10').all(req.params.id, req.params.id);
  res.json({ user, inventory, duels, dungeons });
});

app.post('/api/rpg-users/:id/reset', auth, (req, res) => {
  db.prepare('DELETE FROM rpg_users WHERE telegram_user_id = ?').run(req.params.id);
  db.prepare('DELETE FROM rpg_inventory WHERE telegram_user_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/rpg-users/:id/set-level', auth, (req, res) => {
  const { level } = req.body;
  if (!level || level < 1 || level > 999) return res.status(400).json({ error: 'Invalid level' });
  db.prepare('UPDATE rpg_users SET level = ? WHERE telegram_user_id = ?').run(level, req.params.id);
  res.json({ success: true });
});

app.post('/api/rpg-users/:id/set-gold', auth, (req, res) => {
  const { gold } = req.body;
  if (gold === undefined || gold < 0) return res.status(400).json({ error: 'Invalid gold' });
  db.prepare('UPDATE rpg_users SET gold = ? WHERE telegram_user_id = ?').run(gold, req.params.id);
  res.json({ success: true });
});

// ===== REPORTS =====
app.get('/api/reports', auth, (req, res) => {
  const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50').all();
  res.json(reports);
});

app.delete('/api/reports/:id', auth, (req, res) => {
  db.prepare('DELETE FROM reports WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== ITEMS CATALOG =====
app.get('/api/items', auth, (req, res) => {
  const items = db.prepare('SELECT * FROM items_catalog ORDER BY category, rarity DESC').all();
  res.json(items);
});

app.post('/api/items', auth, (req, res) => {
  const { item_id, display_name, category, rarity, sell_price, effect_json } = req.body;
  if (!item_id || !display_name || !category) return res.status(400).json({ error: 'Missing fields' });
  db.prepare('INSERT OR REPLACE INTO items_catalog (item_id, display_name, category, rarity, sell_price, effect_json) VALUES (?, ?, ?, ?, ?, ?)')
    .run(item_id, display_name, category, rarity || 'common', sell_price || 0, effect_json || null);
  res.json({ success: true });
});

app.delete('/api/items/:id', auth, (req, res) => {
  db.prepare('DELETE FROM items_catalog WHERE item_id = ?').run(req.params.id);
  res.json({ success: true });
});

// ===== QUESTS =====
app.get('/api/quests', auth, (req, res) => {
  const quests = db.prepare('SELECT * FROM quests').all();
  res.json(quests);
});

// ===== TRANSACTIONS =====
app.get('/api/transactions', auth, (req, res) => {
  const tx = db.prepare('SELECT * FROM transactions_log ORDER BY created_at DESC LIMIT 50').all();
  res.json(tx);
});

// ===== DUNGEON RUNS =====
app.get('/api/dungeons', auth, (req, res) => {
  const runs = db.prepare('SELECT * FROM dungeon_runs ORDER BY started_at DESC LIMIT 20').all();
  res.json(runs);
});

// ===== DUEL HISTORY =====
app.get('/api/duels', auth, (req, res) => {
  const duels = db.prepare('SELECT * FROM duel_history ORDER BY started_at DESC LIMIT 20').all();
  res.json(duels);
});

// ===== WORD FILTER =====
app.get('/api/wordfilter', auth, (req, res) => {
  res.json({ words: getWords() });
});

app.post('/api/wordfilter', auth, (req, res) => {
  const { words } = req.body;
  
  fs.writeFileSync(FILTER_PATH, JSON.stringify(words, null, 2));
  res.json({ success: true });
});

// ===== BOSSES CONFIG =====
app.get('/api/bosses', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_bosses.json');
  if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  res.json({ bosses: [] });
});

app.post('/api/bosses', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_bosses.json');
  fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// ===== MONSTERS CONFIG =====
app.get('/api/monsters', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_monsters.json');
  if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  res.json({});
});
app.post('/api/monsters', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_monsters.json');
  fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// ===== SHOPS CONFIG =====
app.get('/api/shops', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_shops.json');
  if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  res.json({});
});
app.post('/api/shops', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_shops.json');
  fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// ===== CRAFTING CONFIG =====
app.get('/api/crafting', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_crafting.json');
  if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  res.json({});
});
app.post('/api/crafting', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_crafting.json');
  fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// ===== QUESTS CONFIG =====
app.get('/api/quests', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_quests.json');
  if (fs.existsSync(p)) return res.json(JSON.parse(fs.readFileSync(p, 'utf8')));
  res.json({});
});
app.post('/api/quests', auth, (req, res) => {
  const p = path.join(__dirname, 'data/rpg_quests.json');
  fs.writeFileSync(p, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

// ===== ICEBREAKERS =====
app.get('/api/icebreakers', auth, (req, res) => {
  res.json({ questions: getQuestions() });
});

app.post('/api/icebreakers', auth, (req, res) => {
  const { questions } = req.body;
  if (!Array.isArray(questions)) return res.status(400).json({ error: 'Questions must be an array' });
  fs.writeFileSync(ICEBREAKERS_JSON_PATH, JSON.stringify(questions, null, 2));
  res.json({ success: true });
});

app.get('/api/logs', auth, (req, res) => {
  const logFile = path.join(__dirname, 'data/bot.log');
  if (!fs.existsSync(logFile)) return res.json({ logs: [] });
  const content = fs.readFileSync(logFile, 'utf8');
  const lines = content.split('\n').filter(Boolean).slice(-100);
  res.json({ logs: lines });
});

// ===== GAME SETTINGS =====
app.get('/api/settings', auth, (req, res) => {
  res.json(getGameSettings());
});

app.post('/api/settings', auth, (req, res) => {
  const newSettings = saveGameSettings(req.body);
  res.json({ success: true, settings: newSettings });
});

// ===== RPG V2 FEATURE FLAGS =====
app.get('/api/rpg-feature-flags', auth, (req, res) => {
  res.json(featureFlags.list());
});

app.post('/api/rpg-feature-flags/:key', auth, (req, res) => {
  if (typeof req.body.enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled must be a boolean' });
  }
  try {
    featureFlags.set(req.params.key, req.body.enabled);
    return res.json({ success: true, flags: featureFlags.list() });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

// ===== RPG OPERATIONS & ECONOMY TELEMETRY =====
app.get('/api/rpg-operations', auth, (req, res) => {
  res.json(collectRpgTelemetry(db, featureFlags));
});

app.get('/api/system-health', auth, (req, res) => {
  res.json({
    database: getDatabaseHealth(db, dbPath),
    observability: { sentryEnabled, dashboardPid: process.pid, uptimeSeconds: Math.round(process.uptime()) },
  });
});

// ===== DYNAMIC RPG CLASSES =====
app.get('/api/classes', auth, (req, res) => {
  const file = path.join(__dirname, 'data/rpg_classes.json');
  if (fs.existsSync(file)) {
    res.json(JSON.parse(fs.readFileSync(file, 'utf8')));
  } else {
    res.json([]);
  }
});

app.post('/api/classes', auth, (req, res) => {
  const { classes } = req.body;
  const file = path.join(__dirname, 'data/rpg_classes.json');
  fs.writeFileSync(file, JSON.stringify(classes, null, 2));
  res.json({ success: true });
});

// ===== BROADCAST (via bot API) =====
app.post('/api/broadcast', auth, (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set' });

  const users = db.prepare('SELECT chat_id FROM users').all();
  let sent = 0, failed = 0;

  // Async broadcast — don't block response
  (async () => {
    for (const u of users) {
      try {
        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: u.chat_id, text: `📢 <b>PENGUMUMAN</b>\n\n${message}`, parse_mode: 'HTML' })
        });
        sent++;
      } catch (e) { failed++; }
      await new Promise(r => setTimeout(r, 50));
    }
    console.log(`[Broadcast] Sent: ${sent}, Failed: ${failed}`);
  })();

  res.json({ success: true, total: users.length });
});

// ===== SEND MESSAGE TO USER =====
app.post('/api/send', auth, (req, res) => {
  const { chat_id, message } = req.body;
  if (!chat_id || !message) return res.status(400).json({ error: 'chat_id and message required' });

  const BOT_TOKEN = process.env.BOT_TOKEN;
  if (!BOT_TOKEN) return res.status(500).json({ error: 'BOT_TOKEN not set' });

  (async () => {
    try {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id, text: message, parse_mode: 'HTML' })
      });
    } catch (e) { console.error('[Send] Error:', e.message); }
  })();

  res.json({ success: true });
});


// ===== MAINTENANCE MODE =====
const MAINTENANCE_FILE = path.join(__dirname, 'data/maintenance.json');

function getMaintenance() {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      return JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
    }
  } catch (e) {}
  return { enabled: false, message: 'Bot sedang dalam maintenance. Silakan coba lagi nanti.' };
}

app.get('/api/maintenance', auth, (req, res) => {
  res.json(getMaintenance());
});

app.post('/api/maintenance', auth, (req, res) => {
  const { enabled, message } = req.body;
  const data = { enabled: !!enabled, message: message || 'Bot sedang dalam maintenance.' };
  fs.writeFileSync(MAINTENANCE_FILE, JSON.stringify(data, null, 2));
  res.json({ success: true, maintenance: data });
});

// ===== BACKUP DATABASE =====
app.get('/api/backup', auth, (req, res) => {
  try {
    const backup = createDatabaseBackup(db, dbPath, 'dashboard');
    res.download(backup, path.basename(backup));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fallback for SPA routing (Express 5 compatible)
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, staticDir, 'index.html'));
});

app.use((error, req, res, next) => {
  if (sentryEnabled) Sentry.captureException(error);
  req.log?.error({ err: error }, 'Dashboard request failed');
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`[Dashboard] Running at http://localhost:${PORT}`);
});
