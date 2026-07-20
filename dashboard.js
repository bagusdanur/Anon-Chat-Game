require('dotenv').config();
const express = require('express');
const path = require('path');
const { db } = require('./src/db');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;
const PASSWORD = process.env.DASHBOARD_PASS || 'ryudev2024';

// Basic auth middleware
function auth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
    return res.status(401).send('Authentication required');
  }
  const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
  const [username, password] = credentials.split(':');
  if (password === PASSWORD) return next();
  res.setHeader('WWW-Authenticate', 'Basic realm="Admin Dashboard"');
  return res.status(401).send('Invalid credentials');
}

app.use(auth);
app.use(express.json());
app.use(express.static(path.join(__dirname, 'dashboard')));

// API: Stats
app.get('/api/stats', (req, res) => {
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const onlineUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status != 'idle'").get().count;
  const pairedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'chatting'").get().count;
  const queuedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'queued'").get().count;
  const bannedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE is_banned = 1").get().count;
  const reports24h = db.prepare("SELECT COUNT(*) as count FROM reports WHERE created_at >= datetime('now', '-1 day')").get().count;
  const rpgUsers = db.prepare('SELECT COUNT(*) as count FROM rpg_users').get().count;

  res.json({ totalUsers, onlineUsers, pairedUsers, queuedUsers, bannedUsers, reports24h, rpgUsers });
});

// API: Users list
app.get('/api/users', (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at DESC LIMIT 100').all();
  res.json(users);
});

// API: Ban/Unban
app.post('/api/users/:id/ban', (req, res) => {
  db.prepare('UPDATE users SET is_banned = 1 WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/users/:id/unban', (req, res) => {
  db.prepare('UPDATE users SET is_banned = 0 WHERE chat_id = ?').run(req.params.id);
  res.json({ success: true });
});

// API: Reports
app.get('/api/reports', (req, res) => {
  const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50').all();
  res.json(reports);
});

// API: RPG Users
app.get('/api/rpg-users', (req, res) => {
  const users = db.prepare('SELECT * FROM rpg_users ORDER BY level DESC LIMIT 50').all();
  res.json(users);
});

// API: Word Filter
app.get('/api/wordfilter', (req, res) => {
  const fs = require('fs');
  const filterPath = path.join(__dirname, 'src/moderation/wordFilter.js');
  const content = fs.readFileSync(filterPath, 'utf8');
  const match = content.match(/const blocklist = \[([^\]]+)\]/);
  if (match) {
    const words = match[1].match(/'([^']+)'/g).map(w => w.replace(/'/g, ''));
    return res.json({ words });
  }
  res.json({ words: [] });
});

app.post('/api/wordfilter', (req, res) => {
  const { words } = req.body;
  const fs = require('fs');
  const filterPath = path.join(__dirname, 'src/moderation/wordFilter.js');
  const newContent = `// Simple blocklist.\nconst blocklist = [${words.map(w => `'${w}'`).join(', ')}];\n\nfunction containsBadWord(text) {\n  if (!text) return false;\n  const lowerText = text.toLowerCase();\n  return blocklist.some(word => lowerText.includes(word));\n}\n\nmodule.exports = {\n  containsBadWord\n};`;
  fs.writeFileSync(filterPath, newContent);
  res.json({ success: true });
});

// Fallback to index.html
// Fallback — redirect to login
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`[Dashboard] Running at http://localhost:${PORT}`);
});
