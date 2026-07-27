require('dotenv').config();
const { db } = require('../src/db');
const { getDatabaseHealth, createDatabaseBackup } = require('../src/rpg/services/databaseMaintenance');
const dbPath = process.env.DATABASE_PATH || require('path').join(__dirname, '../data/bot.db');
const command = process.argv[2] || 'check';

if (command === 'backup') console.log(JSON.stringify({ backup: createDatabaseBackup(db, dbPath, 'manual') }, null, 2));
else console.log(JSON.stringify(getDatabaseHealth(db, dbPath), null, 2));
