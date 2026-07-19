const messageCounts = new Map();
const commandCooldowns = new Map();

const MESSAGE_LIMIT = 20;
const MESSAGE_WINDOW = 60 * 1000; // 1 minute
const COMMAND_COOLDOWN = 2 * 1000; // 2 seconds

function checkMessageLimit(chatId) {
  const now = Date.now();
  if (!messageCounts.has(chatId)) {
    messageCounts.set(chatId, []);
  }
  const timestamps = messageCounts.get(chatId);
  
  // Hapus log yang lebih tua dari 1 menit
  const validTimestamps = timestamps.filter(ts => now - ts < MESSAGE_WINDOW);
  
  if (validTimestamps.length >= MESSAGE_LIMIT) {
    messageCounts.set(chatId, validTimestamps);
    return false; // Limit tercapai
  }
  
  validTimestamps.push(now);
  messageCounts.set(chatId, validTimestamps);
  return true;
}

function checkCommandCooldown(chatId) {
  const now = Date.now();
  const lastTime = commandCooldowns.get(chatId) || 0;
  if (now - lastTime < COMMAND_COOLDOWN) {
    return false; // Sedang cooldown
  }
  commandCooldowns.set(chatId, now);
  return true;
}

function rateLimitMessage(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();

  if (!checkMessageLimit(chatId)) {
    return ctx.reply('Terlalu banyak pesan! Tunggu sebentar (maks 20 pesan/menit).');
  }
  return next();
}

function rateLimitCommand(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();

  if (!checkCommandCooldown(chatId)) {
    return ctx.reply('Tunggu 2 detik sebelum mencari partner lagi.');
  }
  return next();
}

module.exports = {
  rateLimitMessage,
  rateLimitCommand
};
