require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const logger = require('./src/logger');
if (!BOT_TOKEN) {
  logger.error('BOT_TOKEN belum di-set. Copy .env.example jadi .env lalu isi token-nya.');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

const {
  isPaired,
  isQueued,
  pairUsers,
  unpairUser,
  enqueueUser,
  dequeueUser,
  getFirstQueuedExcluding,
  getPartnerId,
  reportUser,
  banUser,
  unbanUser,
  isBanned,
  setLang,
  setGender,
  setMatchGender,
  getAllUserIds,
  db
} = require('./src/db');
const { rateLimitMessage, rateLimitCommand, rateLimitSearch } = require('./src/middleware/rateLimit');
const { containsBadWord } = require('./src/moderation/wordFilter');
const { getRandomTopic } = require('./src/icebreakers');
const { setupRpg, clearRaidSession } = require('./src/rpg/controller');
const { progressBar } = require('./src/format');
const { CLASS_DEFS, xpToNextLevel, getCurrentHp, getCurrentEnergy, getEquipmentBonus, getInventory, getOrCreateUser, getEquippedBonus, getEquipped, equipItem, unequipSlot, CLASS_EQUIP_SLOTS } = require('./src/rpg/db_rpg');
const { RARITY_EMOJI } = require('./src/rpg/profile');

// ===== GLOBAL ERROR HANDLER =====
// Mencegah error seperti "query is too old" atau error Telegram lainnya crash bot
bot.catch((err, ctx) => {
  const desc = err?.response?.description || err?.message || String(err);

  // Abaikan error stale callback query (tombol lama diklik setelah bot restart)
  if (desc.includes('query is too old') || desc.includes('query ID is invalid')) {
    logger.warn({ event: 'stale_callback', desc }, 'Callback query expired, diabaikan.');
    return;
  }
  // Abaikan "message is not modified" (edit pesan yang sama persis)
  if (desc.includes('message is not modified')) return;
  // Abaikan "message to edit not found" (pesan sudah dihapus)
  if (desc.includes('message to edit not found')) return;

  // Log error lain tapi jangan crash
  logger.error({ event: 'bot_error', desc, update: ctx?.update }, 'Unhandled bot error');
});

// ===== MAINTENANCE MODE =====
const fs = require('fs');
const path = require('path');
const MAINTENANCE_FILE = path.join(__dirname, 'data/maintenance.json');

function isMaintenance() {
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
      return data.enabled;
    }
  } catch (e) {}
  return false;
}

function getMaintenanceMsg() {
  let msg = 'Bot sedang dalam maintenance. Silakan coba lagi nanti.';
  try {
    if (fs.existsSync(MAINTENANCE_FILE)) {
      const data = JSON.parse(fs.readFileSync(MAINTENANCE_FILE, 'utf8'));
      if (data.message) msg = data.message;
    }
  } catch (e) {}
  return msg;
}

// Format pesan maintenance yang konsisten
function maintenanceReply(ctx) {
  const msg = getMaintenanceMsg();
  return ctx.reply(
    '🔧 *MAINTENANCE MODE*\n' +
    '━━━━━━━━━━━━━━━━━━━━\n\n' +
    msg + '\n\n' +
    '━━━━━━━━━━━━━━━━━━━━\n' +
    '_Semua fitur sedang tidak tersedia._',
    { parse_mode: 'Markdown' }
  );
}

// ===== MAINTENANCE MIDDLEWARE =====
// Block SEMUA command & pesan saat maintenance (kecuali admin)
bot.use((ctx, next) => {
  if (!isMaintenance()) return next();
  
  const adminCommands = ['stats', 'ban', 'unban', 'broadcast'];
  const text = ctx.message?.text || '';
  const cmd = text.split(' ')[0]?.replace('/', '');
  
  // Admin tetap bisa
  if (ctx.chat?.id?.toString() === ADMIN_CHAT_ID && adminCommands.includes(cmd)) {
    return next();
  }
  
  // Block semua — JANGAN unpair
  return maintenanceReply(ctx);
});

// ===== HANDLERS =====
function handleSearch(ctx) {
  const chatId = ctx.chat.id;

  if (isMaintenance()) {
    return maintenanceReply(ctx);
  }

  if (isBanned(chatId)) {
    return ctx.reply('Akses ditolak. Anda telah diblokir dari menggunakan layanan ini karena pelanggaran aturan.');
  }

  if (isPaired(chatId)) {
    return ctx.reply('Kamu masih lagi ngobrol sama seseorang. Ketik /stop atau /next dulu.');
  }
  if (isQueued(chatId)) {
    return ctx.reply('Kamu masih dalam antrian, tunggu sebentar ya...');
  }

  // Cari partner di antrian (selain diri sendiri)
  const partnerId = getFirstQueuedExcluding(chatId);
  if (partnerId) {
    pairUsers(chatId, partnerId);

    ctx.reply('🎉 Partner ditemukan! Silakan mulai ngobrol.\nKetik /stop untuk mengakhiri atau /next untuk mencari yang lain.');
    bot.telegram.sendMessage(partnerId, '🎉 Partner ditemukan! Silakan mulai ngobrol.\nKetik /stop untuk mengakhiri atau /next untuk mencari yang lain.');
  } else {
    enqueueUser(chatId);
    ctx.reply('⏳ Mencari partner... Mohon tunggu.');
  }
}

function handleStop(ctx) {
  const chatId = ctx.chat.id;

  if (isPaired(chatId)) {
    const partnerId = unpairUser(chatId);
    clearRaidSession(chatId, partnerId);
    ctx.reply('🛑 Chat diakhiri. Ketik /search untuk mencari partner baru.');
    bot.telegram.sendMessage(partnerId, '🛑 Partner mengakhiri chat. Ketik /search untuk mencari partner baru.');
  } else if (isQueued(chatId)) {
    dequeueUser(chatId);
    ctx.reply('🛑 Pencarian dibatalkan.');
  } else {
    ctx.reply('Kamu belum lagi ngobrol atau nyari partner.');
  }
}

// ===== COMMANDS =====
bot.start((ctx) => {
  if (isMaintenance()) {
    return maintenanceReply(ctx);
  }
  ctx.reply(
    '👋 *Selamat datang di Anonymous Chat Bot!*\n\n' +
    'Ngobrol anonim tanpa perlu bongkar identitas asli kamu. 🎭\n\n' +
    'Pilih opsi di bawah ini untuk memulai:',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('🔍 Cari Partner', 'cmd_search')],
        [Markup.button.callback('⚙️ Pengaturan Profil', 'cmd_setting')],
        [Markup.button.callback('🔄 Cari Baru', 'cmd_next'), Markup.button.callback('🛑 Berhenti', 'cmd_stop')]
      ])
    }
  );
});

bot.command('setting' , showSettingMenu);
bot.action('cmd_setting', (ctx) => {
  ctx.answerCbQuery();
  showSettingMenu(ctx);
});

function showSettingMenu(ctx) {
  ctx.reply('⚙️ *Pengaturan Profil & Pencarian*\nAtur identitas dan preferensi pasanganmu di bawah ini:', {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🧑 Saya Pria', 'set_g_m'), Markup.button.callback('👩 Saya Wanita', 'set_g_f')],
      [Markup.button.callback('🔎 Cari Pria', 'set_mg_m'), Markup.button.callback('🔎 Cari Wanita', 'set_mg_f')],
      [Markup.button.callback('🔎 Cari Siapa Saja', 'set_mg_any')]
    ])
  });
}

bot.command('lang', (ctx) => {
  const args = ctx.message.text.split(' ');
  const lang = args[1];
  if (!lang || !['id', 'en', 'any'].includes(lang)) {
    return ctx.reply('Penggunaan: /lang id | /lang en | /lang any');
  }
  setLang(ctx.chat.id, lang);
  ctx.reply(`Preferensi bahasa kamu sekarang diatur ke: ${lang.toUpperCase()}`);
});

bot.command('search', rateLimitSearch, handleSearch);

bot.command('stop', handleStop);

bot.command('next', rateLimitSearch, (ctx) => {
  const chatId = ctx.chat.id;

  if (isPaired(chatId)) {
    const partnerId = unpairUser(chatId);
    clearRaidSession(chatId, partnerId);
    bot.telegram.sendMessage(partnerId, '🛑 Partner meninggalkan chat. Ketik /search untuk mencari partner baru.');
  } else if (isQueued(chatId)) {
    dequeueUser(chatId);
  }

  // Langsung panggil pencarian baru
  handleSearch(ctx);
});

// ===== BUTTON ACTIONS =====
bot.action('cmd_search', rateLimitSearch, (ctx) => {
  ctx.answerCbQuery();
  handleSearch(ctx);
});

bot.action('cmd_next', rateLimitSearch, (ctx) => {
  ctx.answerCbQuery();
  const chatId = ctx.chat.id;
  if (isPaired(chatId)) {
    const partnerId = unpairUser(chatId);
    clearRaidSession(chatId, partnerId);
    bot.telegram.sendMessage(partnerId, '🛑 Partner meninggalkan chat. Ketik /search untuk mencari partner baru.');
  } else if (isQueued(chatId)) {
    dequeueUser(chatId);
  }
  handleSearch(ctx);
});

bot.action('cmd_stop', (ctx) => {
  ctx.answerCbQuery();
  handleStop(ctx);
});

bot.action('cmd_lang_id', (ctx) => {
  ctx.answerCbQuery('Bahasa: ID');
  setLang(ctx.chat.id, 'id');
  ctx.reply('⚙️ Preferensi bahasa diubah ke: ID');
});
bot.action('cmd_lang_en', (ctx) => {
  ctx.answerCbQuery('Language: EN');
  setLang(ctx.chat.id, 'en');
  ctx.reply('⚙️ Preferensi bahasa diubah ke: EN');
});
bot.action('cmd_lang_any', (ctx) => {
  ctx.answerCbQuery('Bahasa: Bebas');
  setLang(ctx.chat.id, 'any');
  ctx.reply('⚙️ Preferensi bahasa diubah ke: BEBAS');
});

bot.action('set_g_m', (ctx) => {
  setGender(ctx.chat.id, 'M');
  ctx.answerCbQuery('Gender: Pria');
  ctx.reply('⚙️ Identitas kamu disetel ke: Pria');
});
bot.action('set_g_f', (ctx) => {
  setGender(ctx.chat.id, 'F');
  ctx.answerCbQuery('Gender: Wanita');
  ctx.reply('⚙️ Identitas kamu disetel ke: Wanita');
});
bot.action('set_mg_m', (ctx) => {
  setMatchGender(ctx.chat.id, 'M');
  ctx.answerCbQuery('Mencari: Pria');
  ctx.reply('⚙️ Target pencarian disetel ke: Pria');
});
bot.action('set_mg_f', (ctx) => {
  setMatchGender(ctx.chat.id, 'F');
  ctx.answerCbQuery('Mencari: Wanita');
  ctx.reply('⚙️ Target pencarian disetel ke: Wanita');
});
bot.action('set_mg_any', (ctx) => {
  setMatchGender(ctx.chat.id, 'any');
  ctx.answerCbQuery('Mencari: Siapa Saja');
  ctx.reply('⚙️ Target pencarian disetel ke: Bebas/Siapa Saja');
});

// ===== ADMIN COMMANDS =====
bot.command('stats', (ctx) => {
  if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
  
  const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const onlineUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status != 'idle'").get().count;
  const pairedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'chatting'").get().count;
  const queuedUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'queued'").get().count;
  const recentReports = db.prepare("SELECT COUNT(*) as count FROM reports WHERE created_at >= datetime('now', '-1 day')").get().count;
  
  const text = `📊 *Bot Stats*\n\n` +
               `Total Users: ${totalUsers}\n` +
               `Active/Online: ${onlineUsers}\n` +
               `Paired Users: ${pairedUsers}\n` +
               `In Queue: ${queuedUsers}\n` +
               `Reports (24h): ${recentReports}`;
  ctx.reply(text, { parse_mode: 'HTML' });
});

bot.command('ban', (ctx) => {
  if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
  const targetId = ctx.message.text.split(' ')[1];
  if (!targetId) return ctx.reply('Penggunaan: /ban <chat_id>');
  banUser(targetId);
  ctx.reply(`User ${targetId} telah di-ban.`);
});

bot.command('unban', (ctx) => {
  if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
  const targetId = ctx.message.text.split(' ')[1];
  if (!targetId) return ctx.reply('Penggunaan: /unban <chat_id>');
  unbanUser(targetId);
  ctx.reply(`User ${targetId} telah di-unban.`);
});

bot.command('broadcast', async (ctx) => {
  if (ctx.chat.id.toString() !== ADMIN_CHAT_ID) return;
  const message = ctx.message.text.split(' ').slice(1).join(' ');
  if (!message) return ctx.reply('Penggunaan: /broadcast <pesan>');
  
  const users = getAllUserIds();
  ctx.reply(`Mulai mengirim broadcast ke ${users.length} pengguna...`);
  
  let successCount = 0;
  for (const userId of users) {
    try {
      await bot.telegram.sendMessage(userId, `📢 <b>PENGUMUMAN</b>\n\n${message}`, { parse_mode: 'HTML' });
      successCount++;
    } catch (e) {
      // Ignored
    }
    await new Promise(r => setTimeout(r, 40)); // 40ms delay
  }
  
  ctx.reply(`Broadcast selesai! Terkirim ke ${successCount}/${users.length} pengguna.`);
});

// ===== EXTRA COMMANDS =====
bot.command('topic', rateLimitCommand, (ctx) => {
  const chatId = ctx.chat.id;
  const partnerId = getPartnerId(chatId);
  
  if (!partnerId) {
    return ctx.reply('Kamu harus sedang terhubung dengan seseorang untuk meminta topik.');
  }
  
  const topic = getRandomTopic();
  const message = `🎲 *Topik Acak*\n\n"${topic}"\n\n_Silakan dibahas bersama partner kamu!_`;
  
  ctx.reply(message, { parse_mode: 'HTML' });
  bot.telegram.sendMessage(partnerId, message, { parse_mode: 'HTML' }).catch(() => {});
});

// ===== REPORT COMMAND =====
bot.command('report', (ctx) => {
  const chatId = ctx.chat.id;
  if (!isPaired(chatId)) {
    return ctx.reply('Kamu tidak sedang terhubung dengan siapa pun. Gunakan perintah ini saat sedang chat dengan seseorang.');
  }
  
  const reason = ctx.message.text.split(' ').slice(1).join(' ') || 'Tidak ada alasan khusus';
  const success = reportUser(chatId, reason);
  
  if (success) {
    ctx.reply('Laporan berhasil dikirim. Terima kasih telah membantu menjaga komunitas ini.');
  } else {
    ctx.reply('Gagal mengirim laporan.');
  }
});

// Set up RPG module
setupRpg(bot, { getPartnerId, rateLimitCommand });

// ===== QUEST SYSTEM =====
const { incrementQuestProgress, claimQuest, getAllDailyQuests } = require('./src/rpg/db_rpg');

bot.command('quest', rateLimitCommand, (ctx) => {
  const userId = ctx.chat.id;
  const user = getOrCreateUser(userId);
  if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

  const args = ctx.message.text.split(' ').slice(1);
  const action = args[0];

  // /quest claim [id] — klaim reward
  if (action === 'claim') {
    const questId = args[1];
    if (!questId) return ctx.reply('Penggunaan: <code>/quest claim [nama_quest]</code>\nContoh: <code>/quest claim daily_hunt_3</code>', { parse_mode: 'HTML' });
    const result = claimQuest(userId, questId);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    const q = result.quest;
    let msg = `✅ <b>Quest Diklaim!</b>\n\n${q.name}\n`;
    if (q.xp_reward > 0) msg += `✨ +${q.xp_reward} XP\n`;
    if (q.gold_reward > 0) msg += `💰 +${q.gold_reward}g\n`;
    if (q.item_reward) msg += `🎁 +1 item\n`;
    return ctx.reply(msg, { parse_mode: 'HTML' });
  }

  // /quest — tampilkan semua quest harian
  const quests = getAllDailyQuests(userId);
  let msg = `📋 <b>Quest Harian</b> _(reset jam 00:00)_\n\n`;

  for (const q of quests) {
    const progress = Math.min(q.current, q.target_count);
    const bar = '█'.repeat(progress) + '░'.repeat(q.target_count - progress);
    let status = '';
    if (q.claimed) status = '✅';
    else if (q.done) status = '🔘 /quest claim ' + q.quest_id;
    else status = `${progress}/${q.target_count}`;

    msg += `${q.name}\n`;
    msg += `   ${q.description}\n`;
    msg += `   ${bar} ${status}\n`;
    msg += `   🎁 ${q.xp_reward}xp + ${q.gold_reward}g`;
    if (q.item_reward) msg += ` + 1 item`;
    msg += '\n\n';
  }

  const total = quests.length;
  const claimed = quests.filter(q => q.claimed).length;
  msg = `📋 <b>Quest Harian</b> — ${claimed}/${total} diklaim\nReset: Jam 00:00 (WIB)\n\n` + msg;

  return ctx.reply(msg, { parse_mode: 'HTML' });
});

// ===== PARTY STATS =====
bot.command('party', rateLimitCommand, (ctx) => {
  const userId = ctx.chat.id;
  const partnerId = getPartnerId(userId);
  if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner (/search) untuk melihat party stats.');

  const user = getOrCreateUser(userId);
  const partner = getOrCreateUser(partnerId);
  if (!user || !partner) return ctx.reply('⚠️ Kedua pemain harus sudah punya karakter (/profile).');

  const clsA = CLASS_DEFS[user.class_name];
  const clsB = CLASS_DEFS[partner.class_name];

  // BUG-04 FIX: gunakan effective stats (base + equip bonus), bukan raw DB value
  const equipA = getEquippedBonus(userId);
  const equipB = getEquippedBonus(partnerId);
  const hpA   = getCurrentHp(user);
  const hpB   = getCurrentHp(partner);

  const renderBar = (cur, max, len = 8) => {
    const filled = Math.min(len, Math.round((Math.max(0, cur) / max) * len));
    return '🟩'.repeat(filled) + '⬛'.repeat(len - filled) + ` ${Math.max(0, cur)}/${max}`;
  };

  let msg = `👥 <b>Party Status</b>\n\n`;

  // Player A
  msg += `<b>${clsA.name} — Lv.${user.level}</b>\n`;
  msg += `❤️ HP: ${renderBar(hpA, user.max_hp)}\n`;
  msg += `⚔️ ATK: <b>${(user.atk || 0) + equipA.atkBonus}</b>  🛡️ DEF: <b>${(user.def || 0) + equipA.defBonus}</b>\n`;
  msg += `💰 Gold: ${user.gold}g\n\n`;

  msg += `<b>🤝 Party</b>\n\n`;

  // Player B (Partner)
  msg += `<b>${clsB.name} — Lv.${partner.level}</b>\n`;
  msg += `❤️ HP: ${renderBar(hpB, partner.max_hp)}\n`;
  msg += `⚔️ ATK: <b>${(partner.atk || 0) + equipB.atkBonus}</b>  🛡️ DEF: <b>${(partner.def || 0) + equipB.defBonus}</b>\n`;
  msg += `💰 Gold: ${partner.gold}g\n\n`;

  // Party summary
  const avgLv   = Math.floor((user.level + partner.level) / 2);
  const totalAtk = ((user.atk || 0) + equipA.atkBonus) + ((partner.atk || 0) + equipB.atkBonus);
  const totalDef = ((user.def || 0) + equipA.defBonus) + ((partner.def || 0) + equipB.defBonus);
  msg += `📊 <b>Party Summary:</b>\n`;
  msg += `   Avg Level: ${avgLv} | Total ATK: ${totalAtk} | Total DEF: ${totalDef}`;

  return ctx.reply(msg, { parse_mode: 'HTML' });
});



bot.command('help', (ctx) => {
  ctx.reply([
    '📖 *Anonymous Chat Bot — Commands*',
    '',
    '🎭 *Anonymous Chat:*',
    '   /search — Cari partner chat',
    '   /next — Cari partner baru',
    '   /stop — Keluar dari chat',
    '   /topic — Topik obrolan acak',
    '   /report — Laporkan partner',
    '   /setting — Atur gender & bahasa',
    '   /lang — Pilih bahasa (id/en/any)',
    '',
    '⚔️ *RPG Commands:*',
    '   /profile — Profil karakter',
    '   /helprpg — Panduan RPG lengkap',
    '   /hunt — Berburu monster',
    '   /fish — Mancing',
    '   /mine — Menambang',
    '   /dungeon — Raid co-op',
    '   /duel — PvP Duel',
    '   /quest — Quest harian',
    '   /party — Stats party',
    '',
    '💰 *Economy:*',
    '   /inv — Inventaris',
    '   /shop — Toko',
    '   /craft — Craft equipment',
    '   /equip — Pasang equipment',
    '   /unequip — Lepas equipment',
    '   /upgrade — Upgrade equipment',
    '   /sell — Jual item',
    '   /use — Pakai item',
    '   /daily — Hadiah harian',
    '   /give — Kirim gold ke partner',
    '   /trade — Kirim item ke partner',
  ].join('\n'), { parse_mode: 'Markdown' });
});


bot.command('equip', rateLimitCommand, (ctx) => {
  const userId = ctx.chat.id;
  const args = ctx.message.text.split(' ').slice(1);
  const input = args.join('_').toLowerCase();

  const user = getOrCreateUser(userId);
  if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

  const cls = CLASS_DEFS[user.class_name];
  const equip = getEquippedBonus(userId);
  const equipped = getEquipped(userId);

  const renderSlot = (item) => {
    if (!item) return '<i>(Kosong)</i>';
    const tier = item.upgrade_tier > 0 ? ` <b>+${item.upgrade_tier}</b>` : '';
    const rarity = RARITY_EMOJI[item.rarity] || '';
    return `${rarity} ${item.display_name}${tier}`;
  };

  if (!input) {
    const effectiveAtk   = (user.atk || 0) + equip.atkBonus;
    const effectiveDef   = (user.def || 0) + equip.defBonus;
    const effectiveMagic = (user.magic_atk || 0) + equip.magicAtkBonus;
    const totalCrit      = Math.min(95, Math.round(((user.crit_rate || 0.05) + equip.critRate) * 100));

    let msg = `<b>🗡️ ${cls.name} — Equipment</b>\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    // Filter slot sesuai class
    const allowedSlots = CLASS_EQUIP_SLOTS[user.class_name] || ['weapon', 'staff', 'armor', 'accessory'];
    const slotEmoji = { weapon: '⚔️', staff: '🪄', armor: '🛡️', accessory: '💍' };
    const slotLabel = { weapon: 'Weapon', staff: 'Staff', armor: 'Armor', accessory: 'Accessory' };
    for (const slot of allowedSlots) {
      msg += `${slotEmoji[slot]} <b>${slotLabel[slot].padEnd(9)}:</b> ${renderSlot(equipped[slot])}\n`;
    }
    msg += `\n━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `<b>📊 Total Stats (Base + Equip)</b>\n`;
    msg += `⚔️ ATK <b>${effectiveAtk}</b>${equip.atkBonus > 0 ? `  <i>(+${equip.atkBonus})</i>` : ''}   `;
    msg += `🛡️ DEF <b>${effectiveDef}</b>${equip.defBonus > 0 ? `  <i>(+${equip.defBonus})</i>` : ''}\n`;
    if (effectiveMagic > 0) msg += `🔮 Magic <b>${effectiveMagic}</b>${equip.magicAtkBonus > 0 ? `  <i>(+${equip.magicAtkBonus})</i>` : ''}\n`;
    msg += `💥 Crit <b>${totalCrit}%</b>\n`;
    if (equip.physResist > 0) msg += `🛡 Phys Resist <b>${Math.round(equip.physResist * 100)}%</b>\n`;
    if (equip.magicResist > 0) msg += `✨ Magic Resist <b>${Math.round(equip.magicResist * 100)}%</b>\n`;
    msg += `\n<i>/equip [nama_item] — Pasang\n/unequip [slot] — Lepas</i>`;
    return ctx.reply(msg, { parse_mode: 'HTML' });
  }

  // Support numeric ID (dari /inv) atau item_id string
  let invItem;
  const inputNum = parseInt(input);
  if (!isNaN(inputNum) && inputNum > 0) {
    // Numeric ID — resolve dari inventory
    const items = getInventory(userId);
    invItem = items[inputNum - 1]; // 1-indexed
  } else {
    // String — cari berdasarkan item_id
    invItem = getInventory(userId).find(i => i.item_id === input);
  }
  if (!invItem) return ctx.reply(`❌ Item "<code>${input}</code>" tidak ada di inventory.\nKetik /inv untuk lihat nomor item.`, { parse_mode: 'HTML' });
  const result = equipItem(userId, invItem.item_id);
  if (!result.success) return ctx.reply(`❌ ${result.reason}`);
  ctx.reply(`✅ <b>${result.item}</b> terpasang di slot <b>${result.slot}</b>!`, { parse_mode: 'HTML' });
});

bot.command('unequip', rateLimitCommand, (ctx) => {
  const userId = ctx.chat.id;
  const args = ctx.message.text.split(' ').slice(1);
  const slot = args[0]?.toLowerCase();

  const user = getOrCreateUser(userId);
  if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

  if (!slot || !['weapon', 'staff', 'armor', 'accessory'].includes(slot)) {
    return ctx.reply('Penggunaan: /unequip [weapon/staff/armor/accessory]');
  }

  // Validasi slot sesuai class
  const allowedSlots = CLASS_EQUIP_SLOTS[user.class_name] || ['weapon', 'staff', 'armor', 'accessory'];
  if (!allowedSlots.includes(slot)) {
    const clsName = CLASS_DEFS[user.class_name]?.name || user.class_name;
    return ctx.reply(`❌ ${clsName} tidak punya slot <b>${slot}</b>.`, { parse_mode: 'HTML' });
  }

  const result = unequipSlot(userId, slot);
  if (!result.success) return ctx.reply(`❌ ${result.reason}`);
  ctx.reply(`✅ <b>${result.item}</b> dilepas dari slot <b>${result.slot}</b>!`, { parse_mode: 'HTML' });
});



// ===== RELAY PESAN =====
// Nge-forward semua jenis pesan (teks, foto, stiker, voice, dll) tanpa nunjukin identitas asli


bot.on('message', rateLimitMessage, async (ctx) => {
  const chatId = ctx.chat.id;

  // Abaikan command yang udah dihandle di atas
  if (ctx.message.text && ctx.message.text.startsWith('/')) return;



  const partnerId = getPartnerId(chatId);
  if (!partnerId) {
    return ctx.reply('Kamu belum terhubung dengan siapa pun. Ketik /search untuk mulai.');
  }

  // Moderation check
  if (ctx.message.text && containsBadWord(ctx.message.text)) {
    return ctx.reply('Pesan kamu mengandung kata-kata yang tidak pantas dan tidak diteruskan.');
  }

  try {
    // copyMessage mengirim ulang konten TANPA label "forwarded from", jadi identitas tetap anonim
    await ctx.telegram.copyMessage(partnerId, chatId, ctx.message.message_id);
    logger.info({ event: 'message_relayed', from: chatId, to: partnerId });
      incrementQuestProgress(chatId, 'message');
  } catch (err) {
    logger.error({ event: 'message_relay_failed', from: chatId, to: partnerId, error: err.message });
    ctx.reply('Gagal mengirim pesan ke partner. Mungkin partner sudah memblokir bot.');
  }
});

// Webhook atau Polling dengan optimasi kecepatan dan drop antrian lama
const launchOptions = {
  dropPendingUpdates: true,
  allowedUpdates: ['message', 'callback_query']
};

if (process.env.WEBHOOK_DOMAIN) {
  bot.launch({
    ...launchOptions,
    webhook: {
      domain: process.env.WEBHOOK_DOMAIN,
      port: process.env.PORT || 3000
    }
  })
  .then(() => logger.info('Bot berjalan dalam mode Webhook (Optimized)...'))
  .catch((err) => logger.error('Gagal menjalankan bot (Webhook): ' + err.message));
} else {
  bot.launch(launchOptions)
  .then(() => logger.info('Bot berjalan dalam mode Polling (Optimized)...'))
  .catch((err) => logger.error('Gagal menjalankan bot (Polling): ' + err.message));
}

const botCommands = [
  // === ANON CHAT (paling atas) ===
  { command: 'start',    description: '👋 Menu utama' },
  { command: 'help',     description: '📖 Lihat semua commands' },
  { command: 'search',   description: '🔍 Mulai cari partner' },
  { command: 'next',     description: '🔄 Cari partner baru' },
  { command: 'stop',     description: '🛑 Keluar dari obrolan' },
  { command: 'setting',  description: '⚙️ Atur gender & bahasa' },
  { command: 'lang',     description: '🌐 Pilih bahasa (id/en/any)' },
  { command: 'topic',    description: '🎲 Topik obrolan acak' },
  { command: 'report',   description: '🚨 Laporkan partner' },
  // === RPG ===
  { command: 'profile',  description: '⚔️ Profil karakter' },
  { command: 'helprpg',  description: '📖 Panduan RPG' },
  { command: 'party',    description: '👥 Stats party' },
  { command: 'quest',    description: '📋 Quest harian' },
  { command: 'duel',     description: '⚔️ PvP Duel' },
  { command: 'hunt',     description: '🗡️ Berburu monster' },
  { command: 'fish',     description: '🎣 Mancing' },
  { command: 'mine',     description: '⛏️ Menambang' },
  { command: 'dungeon',  description: '🏰 Raid co-op' },
  // === ECONOMY ===
  { command: 'inv',      description: '🎒 Inventaris' },
  { command: 'shop',     description: '🏪 Toko' },
  { command: 'craft',    description: '⚒️ Craft equipment' },
  { command: 'equip',    description: '🗡️ Pasang equipment' },
  { command: 'unequip',  description: '📤 Lepas equipment' },
  { command: 'upgrade',  description: '⬆️ Upgrade equipment' },
  { command: 'sell',     description: '💰 Jual item' },
  { command: 'use',      description: '🧪 Pakai item' },
  { command: 'daily',    description: '🎁 Hadiah harian' },
  { command: 'give',     description: '💰 Kirim gold/item ke partner' },
  { command: 'trade',    description: '📦 Kirim item ke partner' },
];

bot.telegram.setMyCommands(botCommands)
  .then(() => logger.info('Menu Telegram (Auto-complete) berhasil diperbarui.'))
  .catch((err) => logger.error('Gagal update menu commands: ' + err.message));

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// ===== SAFETY NET: Tangkap semua unhandled error agar bot tidak crash =====
// Ini menangkap error async yang lolos dari bot.catch (misal di setTimeout, .catch kosong, dsb)
const IGNORABLE_ERRORS = [
  'query is too old',
  'query ID is invalid',
  'message is not modified',
  'message to edit not found',
  'bot was blocked by the user',
  'chat not found',
];

process.on('unhandledRejection', (reason) => {
  const msg = reason?.response?.description || reason?.message || String(reason);
  if (IGNORABLE_ERRORS.some(e => msg.includes(e))) {
    logger.warn({ event: 'ignored_rejection', msg }, 'Unhandled rejection diabaikan (known Telegram error)');
    return;
  }
  logger.error({ event: 'unhandled_rejection', msg }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (err) => {
  const msg = err?.response?.description || err?.message || String(err);
  if (IGNORABLE_ERRORS.some(e => msg.includes(e))) {
    logger.warn({ event: 'ignored_exception', msg }, 'Uncaught exception diabaikan (known Telegram error)');
    return;
  }
  logger.error({ event: 'uncaught_exception', msg }, 'Uncaught exception — bot tetap berjalan');
});