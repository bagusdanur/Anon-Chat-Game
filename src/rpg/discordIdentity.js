const { db } = require('../db');
function discordUserKey(userId) { return `discord:${String(userId)}`; }
function ensureDiscordIdentity(userId, guildId = null) {
  const key = discordUserKey(userId);
  try { db.exec("ALTER TABLE rpg_users ADD COLUMN platform TEXT NOT NULL DEFAULT 'telegram'"); } catch (_) {}
  try { db.exec('ALTER TABLE rpg_users ADD COLUMN platform_user_id TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE rpg_users ADD COLUMN guild_id TEXT'); } catch (_) {}
  db.prepare("UPDATE rpg_users SET platform='discord', platform_user_id=?, guild_id=? WHERE telegram_user_id=?").run(String(userId), guildId == null ? null : String(guildId), key);
  return key;
}
module.exports = { discordUserKey, ensureDiscordIdentity };
