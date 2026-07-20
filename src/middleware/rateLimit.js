const messageCounts = new Map();
const commandCooldowns = new Map();
const searchCooldowns = new Map();

const MESSAGE_LIMIT = 20;
const MESSAGE_WINDOW = 60 * 1000; // 1 menit
const COMMAND_COOLDOWN = 1500;    // 1.5 detik — untuk command umum (silent)
const SEARCH_COOLDOWN = 3 * 1000; // 3 detik — khusus /search & /next (dengan reply)

// ===== PERIODIC CLEANUP =====
// Cegah memory leak dari Maps yang tidak pernah dibersihkan
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 menit
const STALE_THRESHOLD = 10 * 60 * 1000; // 10 menit — hapus entries yang sudah lama

setInterval(() => {
  const now = Date.now();

  // Cleanup messageCounts — hapus chatId yang timestamp terakhirnya > 10 menit lalu
  for (const [chatId, timestamps] of messageCounts) {
    const lastTs = timestamps[timestamps.length - 1];
    if (now - lastTs > STALE_THRESHOLD) {
      messageCounts.delete(chatId);
    }
  }

  // Cleanup commandCooldowns — hapus entry > 10 menit lalu
  for (const [chatId, lastTime] of commandCooldowns) {
    if (now - lastTime > STALE_THRESHOLD) {
      commandCooldowns.delete(chatId);
    }
  }

  // Cleanup searchCooldowns — hapus entry > 10 menit lalu
  for (const [chatId, lastTime] of searchCooldowns) {
    if (now - lastTime > STALE_THRESHOLD) {
      searchCooldowns.delete(chatId);
    }
  }
}, CLEANUP_INTERVAL);


function checkMessageLimit(chatId) {
  const now = Date.now();
  if (!messageCounts.has(chatId)) messageCounts.set(chatId, []);
  const timestamps = messageCounts.get(chatId);
  const valid = timestamps.filter(ts => now - ts < MESSAGE_WINDOW);
  if (valid.length >= MESSAGE_LIMIT) {
    messageCounts.set(chatId, valid);
    return false;
  }
  valid.push(now);
  messageCounts.set(chatId, valid);
  return true;
}

function checkCommandCooldown(chatId) {
  const now = Date.now();
  const last = commandCooldowns.get(chatId) || 0;
  if (now - last < COMMAND_COOLDOWN) return false;
  commandCooldowns.set(chatId, now);
  return true;
}

function checkSearchCooldown(chatId) {
  const now = Date.now();
  const last = searchCooldowns.get(chatId) || 0;
  if (now - last < SEARCH_COOLDOWN) return false;
  searchCooldowns.set(chatId, now);
  return true;
}

// Untuk pesan biasa — reply jika spam
function rateLimitMessage(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();
  if (!checkMessageLimit(chatId)) {
    return ctx.reply('⚠️ Terlalu banyak pesan! Tunggu sebentar (maks 20 pesan/menit).');
  }
  return next();
}

// Untuk command umum (RPG, shop, inv, dll) — silent skip tanpa reply
// Mencegah spam tapi tidak mengganggu UX navigasi
function rateLimitCommand(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();
  if (!checkCommandCooldown(chatId)) return; // silent — tidak reply
  return next();
}

// Khusus /search & /next — reply dengan pesan kontekstual
function rateLimitSearch(ctx, next) {
  const chatId = ctx.chat?.id;
  if (!chatId) return next();
  if (!checkSearchCooldown(chatId)) {
    return ctx.reply('⏳ Tunggu sebentar sebelum mencari partner lagi.');
  }
  return next();
}

module.exports = {
  rateLimitMessage,
  rateLimitCommand,
  rateLimitSearch,
};
