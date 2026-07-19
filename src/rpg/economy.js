// src/rpg/economy.js
// Fase 3 & 4: /inv, /shop, /buy, /sell, /daily, /craft, /upgrade, /give
const { Markup } = require('telegraf');
const { db } = require('../db');
const {
  getOrCreateUser, getInventory, getItem, removeItem, addItem,
  spendGold, addGold, getCatalogItem, upgradeItem, updateHp,
  getCurrentHp, logTransaction, addXp
} = require('./db_rpg');
const { RARITY_EMOJI } = require('./profile');

// ID numerik statis untuk shop (1-indexed, tidak berubah)
const SHOP_ITEMS = [
  { id: 1, item_id: 'ramuan_kecil',  buy_price: 15  },
  { id: 2, item_id: 'ramuan_besar',  buy_price: 50  },
  { id: 3, item_id: 'kail_plus',     buy_price: 200 },
  { id: 4, item_id: 'beliung_plus',  buy_price: 300 },
];

// Cache inventory per user (session, bukan persisten) untuk resolusi ID numerik
// key: userId, value: [item_id, ...] berurutan sesuai tampilan /inv
const invCache = new Map();

// Cache untuk pending upgrade confirmation
const upgradeConfirmCache = new Map();

function resolveShopInput(input) {
  // Bisa angka (ID) atau string (item_id)
  const num = parseInt(input);
  if (!isNaN(num)) return SHOP_ITEMS.find(s => s.id === num) || null;
  return SHOP_ITEMS.find(s => s.item_id === input.toLowerCase()) || null;
}

function resolveInvInput(userId, input) {
  const num = parseInt(input);
  const cache = invCache.get(userId.toString());
  if (!isNaN(num) && cache) {
    return cache[num - 1] || null; // ID 1-indexed
  }
  // fallback ke item_id string
  return input.toLowerCase();
}

function setupEconomy(bot, { getPartnerId, rateLimitCommand }) {
  // ===== /inv =====
  bot.command('inv', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const items = getInventory(userId);
    if (items.length === 0) {
      return ctx.reply('🎒 <b>Inventaris kosong.</b>\n<i>Coba /hunt, /fish, atau /mine untuk mendapatkan item!</i>', { parse_mode: 'HTML' });
    }

    // Simpan urutan ke cache untuk resolusi ID numerik
    const orderedIds = [];
    const categories = { weapon: '⚔️ Senjata', armor: '🛡️ Armor', consumable: '🧪 Konsumable', material: '📦 Material' };
    const grouped = {};
    for (const item of items) {
      if (!grouped[item.category]) grouped[item.category] = [];
      grouped[item.category].push(item);
    }

    let slotNum = 1;
    let msg = `🎒 <b>Inventaris</b> — 💰 ${user.gold}g\n\n`;

    for (const [cat, label] of Object.entries(categories)) {
      if (!grouped[cat]) continue;
      msg += `<b>${label}</b>\n`;
      for (const item of grouped[cat]) {
        const tierStr = item.upgrade_tier > 0 ? ` (+${item.upgrade_tier})` : '';
        msg += `<code>[${slotNum}]</code> ${RARITY_EMOJI[item.rarity]} ${item.display_name}${tierStr} x${item.quantity}\n`;
        orderedIds.push(item.item_id);
        slotNum++;
      }
      msg += '\n';
    }

    invCache.set(userId.toString(), orderedIds);

    msg += `<i>Gunakan nomor: /use 1 • /sell 2 • /upgrade 3</i>`;
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /shop =====
  bot.command('shop', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    let msg = `🏪 <b>Toko Petualang</b> — Saldo: 💰 ${user.gold}g\n\n`;
    for (const shopItem of SHOP_ITEMS) {
      const catalog = getCatalogItem(shopItem.item_id);
      if (catalog) {
        msg += `<code>[${shopItem.id}]</code> ${RARITY_EMOJI[catalog.rarity]} <b>${catalog.display_name}</b> — ${shopItem.buy_price}g\n`;
      }
    }
    msg += `\n<i>Ketik /buy [nomor atau nama] untuk membeli</i>\n`;
    msg += `Contoh: <code>/buy 1</code> atau <code>/buy ramuan_kecil</code>`;
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /buy (terima nomor ID atau nama) =====
  bot.command('buy', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args.join('_').toLowerCase();

    if (!input) return ctx.reply('Penggunaan: <code>/buy [nomor]</code> atau <code>/buy [nama_item]</code>\nCek /shop untuk daftar.', { parse_mode: 'HTML' });

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const shopEntry = resolveShopInput(input);
    if (!shopEntry) return ctx.reply(`❌ Item "${input}" tidak ada di toko. Cek /shop.`);

    const catalog = getCatalogItem(shopEntry.item_id);
    if (spendGold(userId, shopEntry.buy_price)) {
      addItem(userId, shopEntry.item_id);
      ctx.reply(`✅ Berhasil membeli <b>${catalog.display_name}</b> seharga ${shopEntry.buy_price}g!`, { parse_mode: 'HTML' });
    } else {
      ctx.reply(`❌ Gold tidak cukup! Butuh ${shopEntry.buy_price}g. Saldo: ${user.gold}g.`);
    }
  });

  // ===== /sell (terima nomor ID dari /inv atau nama) =====
  bot.command('sell', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args.join('_').toLowerCase();

    if (!input) return ctx.reply('Penggunaan: <code>/sell [nomor]</code> atau <code>/sell [nama_item]</code>\nKetik /inv untuk lihat nomor item.', { parse_mode: 'HTML' });

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const itemId = resolveInvInput(userId, input);
    if (!itemId) return ctx.reply('❌ Nomor item tidak valid. Ketik /inv dulu untuk refresh daftar.');

    const invItem = getItem(userId, itemId);
    if (!invItem) return ctx.reply(`❌ Kamu tidak punya item tersebut di inventaris.`);
    if (invItem.sell_price === 0) return ctx.reply(`❌ <b>${invItem.display_name}</b> tidak bisa dijual.`, { parse_mode: 'HTML' });

    if (removeItem(userId, itemId, 1)) {
      addGold(userId, invItem.sell_price);
      // Invalidate cache setelah sell
      invCache.delete(userId.toString());
      ctx.reply(`✅ Berhasil menjual <b>${invItem.display_name}</b> seharga ${invItem.sell_price}g!`, { parse_mode: 'HTML' });
    } else {
      ctx.reply(`❌ Gagal menjual item. Pastikan kamu punya item tersebut.`);
    }
  });

  // ===== /use (terima nomor ID dari /inv atau nama) =====
  bot.command('use', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args.join('_').toLowerCase();

    if (!input) return ctx.reply('Penggunaan: <code>/use [nomor]</code> atau <code>/use [nama_item]</code>\nContoh: <code>/use 1</code>', { parse_mode: 'HTML' });

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const itemId = resolveInvInput(userId, input);
    if (!itemId) return ctx.reply('❌ Nomor item tidak valid. Ketik /inv dulu untuk refresh daftar.');

    const invItem = getItem(userId, itemId);
    if (!invItem) return ctx.reply(`❌ Kamu tidak punya item tersebut.`);
    if (invItem.category !== 'consumable') return ctx.reply(`❌ Item ini tidak bisa digunakan secara langsung.`);

    const effect = invItem.effect_json ? JSON.parse(invItem.effect_json) : {};
    let msg = `🧪 Menggunakan <b>${invItem.display_name}</b>...\n\n`;

    if (effect.heal_pct) {
      const currentHp = getCurrentHp(user);
      const healAmount = Math.floor(user.max_hp * effect.heal_pct / 100);
      const newHp = Math.min(user.max_hp, currentHp + healAmount);
      updateHp(userId, newHp);
      msg += `❤️ HP dipulihkan +${healAmount} (${newHp}/${user.max_hp})`;
    } else {
      msg += `Efek tidak diketahui.`;
    }

    removeItem(userId, itemId, 1);
    invCache.delete(userId.toString());
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /daily =====
  bot.command('daily', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const now = Math.floor(Date.now() / 1000);
    const cooldownSecs = 20 * 3600; // 20 jam
    if (user.last_daily_claim_at && now - user.last_daily_claim_at < cooldownSecs) {
      const remaining = cooldownSecs - (now - user.last_daily_claim_at);
      const hours = Math.floor(remaining / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      return ctx.reply(`⏳ Hadiah harian sudah diambil! Kembali dalam *${hours}j ${mins}m*.`, { parse_mode: 'Markdown' });
    }

    // Claim daily
    addGold(userId, 30);
    addXp(userId, 10);
    addItem(userId, 'ramuan_kecil');
    const { db } = require('../db');
    db.prepare('UPDATE rpg_users SET last_daily_claim_at = ? WHERE telegram_user_id = ?').run(now, userId.toString());

    ctx.reply(
      `🎁 *Hadiah Harian!*\n\n` +
      `💰 +30 Gold\n✨ +10 XP\n🧪 +1 Ramuan Kecil\n\n` +
      `_Kembali lagi dalam 20 jam!_`,
      { parse_mode: 'Markdown' }
    );
  });

  // ===== /upgrade (terima nomor ID dari /inv atau nama) =====
  bot.command('upgrade', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args.join('_').toLowerCase();

    if (!input) return ctx.reply('Penggunaan: <code>/upgrade [nomor]</code> atau <code>/upgrade [nama_item]</code>\nCek /inv untuk nomor item.', { parse_mode: 'HTML' });

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const itemId = resolveInvInput(userId, input);
    if (!itemId) return ctx.reply('❌ Nomor item tidak valid. Ketik /inv dulu untuk refresh daftar.');

    const invItem = getItem(userId, itemId);
    if (!invItem) return ctx.reply(`❌ Kamu tidak punya item tersebut.`);
    if (!['weapon', 'armor'].includes(invItem.category)) return ctx.reply(`❌ Hanya senjata/armor yang bisa di-upgrade.`);
    if (invItem.upgrade_tier >= 5) return ctx.reply(`⚠️ <b>${invItem.display_name}</b> sudah di tier maksimal (+5)!`, { parse_mode: 'HTML' });

    const currentTier = invItem.upgrade_tier;
    const nextTier = currentTier + 1;
    const oreNeeded = nextTier * 3;
    const goldNeeded = nextTier * 100;
    const statType = invItem.category === 'weapon' ? 'ATK' : 'DEF';

    // Hitung total ore yang dimiliki
    const oreTypes = ['besi_rongsok', 'tembaga', 'batu_bara', 'besi', 'perak', 'emas_ore'];
    let totalOre = 0;
    for (const oreId of oreTypes) {
      const oreItem = getItem(userId, oreId);
      if (oreItem) totalOre += oreItem.quantity;
    }

    const canAfford = user.gold >= goldNeeded && totalOre >= oreNeeded;
    const oreStatus = totalOre >= oreNeeded ? `✅ ${totalOre}/${oreNeeded}` : `❌ ${totalOre}/${oreNeeded}`;
    const goldStatus = user.gold >= goldNeeded ? `✅ ${user.gold}/${goldNeeded}g` : `❌ ${user.gold}/${goldNeeded}g`;

    // Tampilkan preview biaya sebelum konfirmasi
    const previewMsg =
      `⚒️ <b>Preview Upgrade</b>\n\n` +
      `📦 Item: <b>${invItem.display_name}</b> (+${currentTier} → +${nextTier})\n` +
      `📈 Efek: +2 ${statType} permanen\n\n` +
      `<b>Biaya:</b>\n` +
      `💰 Gold: ${goldStatus}\n` +
      `⛏️ Ore: ${oreStatus}\n\n` +
      (canAfford ? `_Lanjutkan upgrade?_` : `❌ <b>Material tidak cukup!</b>`);

    if (!canAfford) return ctx.reply(previewMsg, { parse_mode: 'HTML' });

    // Simpan pending upgrade di cache
    upgradeConfirmCache.set(userId.toString(), { itemId, currentTier });

    ctx.reply(previewMsg, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('✅ Upgrade!', `upgrade:confirm`), Markup.button.callback('❌ Batal', `upgrade:cancel`)]
      ])
    });
  });

  // Konfirmasi upgrade
  bot.action('upgrade:confirm', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const pending = upgradeConfirmCache.get(userId.toString());
    if (!pending) return ctx.answerCbQuery('Tidak ada upgrade yang pending.', { show_alert: true });
    upgradeConfirmCache.delete(userId.toString());

    const { itemId, currentTier } = pending;
    const user = getOrCreateUser(userId);
    if (!user) return ctx.answerCbQuery('Data tidak ditemukan.', { show_alert: true });

    const invItem = getItem(userId, itemId);
    if (!invItem || invItem.upgrade_tier !== currentTier) {
      return ctx.answerCbQuery('Item berubah sejak preview. Coba lagi.', { show_alert: true });
    }

    const nextTier = currentTier + 1;
    const oreNeeded = nextTier * 3;
    const goldNeeded = nextTier * 100;
    const oreTypes = ['besi_rongsok', 'tembaga', 'batu_bara', 'besi', 'perak', 'emas_ore'];
    let totalOre = 0;
    for (const oreId of oreTypes) {
      const oreItem = getItem(userId, oreId);
      if (oreItem) totalOre += oreItem.quantity;
    }

    if (totalOre < oreNeeded) {
      return ctx.answerCbQuery('Material tidak cukup!', { show_alert: true });
    }

    // Atomic: spendGold + removeItem ore + upgradeItem dalam satu transaction
    const upgradeSuccess = db.transaction(() => {
      if (!spendGold(userId, goldNeeded)) return false;
      let remaining = oreNeeded;
      for (const oreId of oreTypes) {
        if (remaining <= 0) break;
        const oreItem = getItem(userId, oreId);
        if (!oreItem) continue;
        const use = Math.min(remaining, oreItem.quantity);
        removeItem(userId, oreId, use);
        remaining -= use;
      }
      upgradeItem(userId, itemId);
      return true;
    })();

    if (!upgradeSuccess) {
      return ctx.answerCbQuery('Gold tidak cukup!', { show_alert: true });
    }

    invCache.delete(userId.toString());
    const statType = invItem.category === 'weapon' ? 'ATK' : 'DEF';
    ctx.answerCbQuery('Upgrade berhasil!');
    ctx.editMessageText(
      `⚒️ <b>Upgrade Berhasil!</b>\n\n<b>${invItem.display_name}</b> → <b>+${nextTier}</b>\n+2 ${statType} ditambahkan ke karakter!\n\n<i>Cek /profile untuk stats terbaru.</i>`,
      { parse_mode: 'HTML' }
    );
  });

  bot.action('upgrade:cancel', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    upgradeConfirmCache.delete(userId.toString());
    ctx.answerCbQuery('Dibatalkan.');
    ctx.editMessageText('❌ Upgrade dibatalkan.');
  });


  // ===== /give =====
  bot.command('give', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const amount = parseInt(args[0]);

    if (!amount || amount <= 0) return ctx.reply('Penggunaan: /give <jumlah>. Contoh: /give 100\n(Hanya bisa ke partner yang sedang paired, pajak 5%)');

    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner dulu (/search).');

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    const partner = getOrCreateUser(partnerId);
    if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG.');

    const tax = Math.floor(amount * 0.05);
    const received = amount - tax;

    // Atomic: spendGold + addGold dalam satu transaction
    const transferSuccess = db.transaction(() => {
      if (!spendGold(userId, amount)) return false;
      addGold(partnerId, received);
      return true;
    })();

    if (!transferSuccess) {
      return ctx.reply(`❌ Gold tidak cukup! Butuh ${amount}g. Saldo: ${user.gold}g.`);
    }

    logTransaction(userId, partnerId, received, 'give_transfer');
    logTransaction(userId, null, tax, 'give_tax');

    ctx.reply(`✅ Berhasil mengirim *${received}g* ke partner (pajak 5% = ${tax}g).`, { parse_mode: 'Markdown' });
    bot.telegram.sendMessage(partnerId, `💰 Kamu menerima *${received}g* dari partner!`, { parse_mode: 'Markdown' }).catch(() => {});
  });
}

module.exports = { setupEconomy, SHOP_ITEMS };
