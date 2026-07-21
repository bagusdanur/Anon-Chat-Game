// src/rpg/economy.js
// Fase 3 & 4: /inv, /shop, /buy, /sell, /daily, /craft, /upgrade, /give
const { Markup } = require('telegraf');
const { db } = require('../db');
const {
  getOrCreateUser, getInventory, getItem, removeItem, addItem,
  getCatalogItem, upgradeItem, updateHp,
  getCurrentHp, logTransaction, addXp, addGold, spendGold,
  incrementQuestProgress,
  equipItem, unequipSlot, getEquipped, getEquippedBonus, GOLD_CAP, INVENTORY_CAP
} = require('./db_rpg');
const { RARITY_EMOJI } = require('./profile');
const { getGameSettings } = require('./config');

const fs = require('fs');
const path = require('path');

function getShopConfig() {
  try {
    const configPath = path.join(__dirname, '../../data/rpg_shops.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')).shop_items || [];
    }
  } catch (e) {
    console.error('Failed to load rpg_shops.json:', e);
  }
  return [];
}

function getCraftingConfig() {
  try {
    const configPath = path.join(__dirname, '../../data/rpg_crafting.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')).recipes || [];
    }
  } catch (e) {
    console.error('Failed to load rpg_crafting.json:', e);
  }
  return [];
}

// Cache inventory per user (session, bukan persisten) untuk resolusi ID numerik
// key: userId, value: [item_id, ...] berurutan sesuai tampilan /inv
const invCache = new Map();

// Cache untuk pending upgrade confirmation
const upgradeConfirmCache = new Map();

// UX-03: Cache untuk pending sell confirmation (item epic/legendary)
const sellConfirmCache = new Map();

function resolveShopInput(input) {
  // Bisa angka (ID) atau string (item_id)
  const num = parseInt(input);
  const shopItems = getShopConfig();
  if (!isNaN(num)) return shopItems.find(s => s.id === num) || null;
  return shopItems.find(s => s.item_id === input.toLowerCase()) || null;
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

    let msg = `🛒 <b>TOKO (SHOP)</b>\n`;
    msg += `💰 Saldo: <b>${user.gold}g</b>\n`;
    msg += `<i>Beli item dengan gold. Ketik /buy &lt;ID/Nama&gt;</i>\n\n`;

    const shopItems = getShopConfig();
    for (const s of shopItems) {
      const catalog = getCatalogItem(s.item_id);
      if (catalog) {
        msg += `<code>[${s.id}]</code> ${RARITY_EMOJI[catalog.rarity]} <b>${catalog.display_name}</b> — ${s.buy_price}g\n`;
      }
    }
    msg += `\n<i>Ketik /buy [nomor atau nama] untuk membeli</i>\n`;
    msg += `Contoh: <code>/buy 1</code> atau <code>/buy ramuan_kecil</code>`;
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /shop2 — Special Shop (Lv20+, gold sink) =====
function getSpecialShopConfig() {
  try {
    const configPath = path.join(__dirname, '../../data/rpg_shops.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')).special_shop || [];
    }
  } catch (e) {
    console.error('Failed to load rpg_shops.json (special_shop):', e);
  }
  return [];
}

  bot.command('shop2', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    if (user.level < 20) return ctx.reply('🔒 Special Shop unlock di <b>Lv 20</b>!', { parse_mode: 'HTML' });

    let msg = `<b>🏪 SPECIAL SHOP</b> — Lv20+ Only\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `Saldo: 💰 <b>${user.gold}g</b> / <code>${GOLD_CAP}g</code>\n\n`;
    
    const specialShopItems = getSpecialShopConfig();
    for (const item of specialShopItems) {
      const catalog = getCatalogItem(item.item_id);
      if (catalog) {
        msg += `<code>[${item.id}]</code> ${RARITY_EMOJI[catalog.rarity]} <b>${catalog.display_name}</b> — ${item.buy_price.toLocaleString()}g\n`;
      }
    }
    msg += `\n<i>Ketik /buy2 [nomor] untuk membeli</i>`;
    ctx.reply(msg, { parse_mode: 'HTML' });
  });

  // ===== /buy2 — Beli dari Special Shop =====
  bot.command('buy2', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args.join('_').toLowerCase();

    if (!input) return ctx.reply('Penggunaan: <code>/buy2 [nomor]</code>\nCek /shop2 untuk daftar.', { parse_mode: 'HTML' });

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    if (user.level < 20) return ctx.reply('🔒 Special Shop unlock di <b>Lv 20</b>!', { parse_mode: 'HTML' });

    const num = parseInt(input);
    const specialShopItems = getSpecialShopConfig();
    const shopEntry = specialShopItems.find(s => s.id === num);
    if (!shopEntry) return ctx.reply('❌ Nomor tidak valid. Cek /shop2.', { parse_mode: 'HTML' });

    const catalog = getCatalogItem(shopEntry.item_id);
    if (spendGold(userId, shopEntry.buy_price)) {
      if (!addItem(userId, shopEntry.item_id)) {
        // Inventory penuh — kembalikan gold
        addGold(userId, shopEntry.buy_price);
        return ctx.reply('❌ Inventory penuh! Jual atau gunakan item dulu.', { parse_mode: 'HTML' });
      }
      ctx.reply(`✅ Berhasil membeli <b>${catalog.display_name}</b> seharga ${shopEntry.buy_price.toLocaleString()}g!`, { parse_mode: 'HTML' });
    } else {
      ctx.reply(`❌ Gold tidak cukup! Butuh ${shopEntry.buy_price.toLocaleString()}g. Saldo: ${user.gold}g.`, { parse_mode: 'HTML' });
    }
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
      if (!addItem(userId, shopEntry.item_id)) {
        addGold(userId, shopEntry.buy_price);
        return ctx.reply('❌ Inventory penuh! Jual atau gunakan item dulu.', { parse_mode: 'HTML' });
      }
      // BUG-02 FIX: invalidate cache setelah beli agar /sell tidak pakai data stale
      invCache.delete(userId.toString());
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

    // UX-03: Item epic/legendary butuh konfirmasi sebelum jual
    if (invItem.rarity === 'epic' || invItem.rarity === 'legendary') {
      sellConfirmCache.set(userId.toString(), { itemId, displayName: invItem.display_name, sellPrice: invItem.sell_price });
      const rarityWarning = invItem.rarity === 'legendary' ? '🟠 LEGENDARY' : '🟣 EPIC';
      return ctx.reply(
        `⚠️ <b>Konfirmasi Jual Item ${rarityWarning}</b>\n\n` +
        `Kamu akan menjual <b>${invItem.display_name}</b> seharga <b>${invItem.sell_price}g</b>.\n\n` +
        `<i>Item ini tidak bisa dikembalikan setelah dijual!</i>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Ya, Jual!', 'sell:confirm'), Markup.button.callback('❌ Batal', 'sell:cancel')]
          ])
        }
      );
    }

    if (removeItem(userId, itemId, 1)) {
      addGold(userId, invItem.sell_price);
      // Invalidate cache setelah sell
      invCache.delete(userId.toString());
      ctx.reply(`✅ Berhasil menjual <b>${invItem.display_name}</b> seharga ${invItem.sell_price}g!`, { parse_mode: 'HTML' });
      incrementQuestProgress(userId, 'sell');
    } else {
      ctx.reply(`❌ Gagal menjual item. Pastikan kamu punya item tersebut.`);
    }
  });

  // Handler konfirmasi sell item epic/legendary
  bot.action('sell:confirm', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const pending = sellConfirmCache.get(userId.toString());
    if (!pending) return ctx.answerCbQuery('Tidak ada item yang menunggu konfirmasi.', { show_alert: true });
    sellConfirmCache.delete(userId.toString());

    const { itemId, displayName, sellPrice } = pending;
    if (removeItem(userId, itemId, 1)) {
      addGold(userId, sellPrice);
      invCache.delete(userId.toString());
      incrementQuestProgress(userId, 'sell');
      ctx.answerCbQuery('Berhasil dijual!');
      ctx.editMessageText(`✅ <b>${displayName}</b> berhasil dijual seharga <b>${sellPrice}g</b>!`, { parse_mode: 'HTML' });
    } else {
      ctx.answerCbQuery('Gagal menjual!', { show_alert: true });
    }
  });

  bot.action('sell:cancel', (ctx) => {
    const userId = ctx.chat.id;
    sellConfirmCache.delete(userId.toString());
    ctx.answerCbQuery('Dibatalkan.');
    ctx.editMessageText('❌ Penjualan dibatalkan.');
  });



  // ===== /craft — Crafting Equipment dari Material =====
  bot.command('craft', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args.join(' ').toLowerCase();

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const CRAFT_RECIPES = getCraftingConfig();

    // Tanpa argumen → tampilkan daftar resep
    if (!input) {
      let msg = `🛠️ <b>CRAFTING</b>\n`;
      msg += `<i>Gabungkan material menjadi item langka!</i>\n`;
      msg += `<i>Gunakan: /craft &lt;ID&gt;</i>\n\n`;

      // Group by category
      const categories = {
        '⚔️ Weapons': CRAFT_RECIPES.filter(r => getCatalogItem(r.result)?.category === 'weapon'),
        '🪄 Staffs': CRAFT_RECIPES.filter(r => getCatalogItem(r.result)?.category === 'staff'),
        '🛡️ Armor': CRAFT_RECIPES.filter(r => getCatalogItem(r.result)?.category === 'armor'),
        '💍 Accessories': CRAFT_RECIPES.filter(r => getCatalogItem(r.result)?.category === 'accessory'),
        '🧪 Consumables': CRAFT_RECIPES.filter(r => getCatalogItem(r.result)?.category === 'consumable'),
      };

      for (const [catName, recipes] of Object.entries(categories)) {
        if (recipes.length === 0) continue;
        msg += `<b>${catName}:</b>\n`;
        for (const r of recipes) {
          const catalog = getCatalogItem(r.result);
          const rarity = catalog ? RARITY_EMOJI[catalog.rarity] || '' : '';
          const mats = r.materials.map(m => `${m.qty}x ${m.item.replace(/_/g, ' ')}`).join(' + ');
          msg += `  <code>[${r.id}]</code> ${rarity} ${r.name} — ${r.gold}g\n`;
          msg += `     └─ ${mats}\n`;
        }
        msg += '\n';
      }
      return ctx.reply(msg, { parse_mode: 'HTML' });
    }

    // Cari resep berdasarkan nomor atau nama
    let recipe = null;
    const num = parseInt(input);
    if (!isNaN(num)) {
      recipe = CRAFT_RECIPES.find(r => r.id === num);
    } else {
      const cleanInput = input.replace(/\s+/g, '_');
      recipe = CRAFT_RECIPES.find(r => r.result === cleanInput || r.name.toLowerCase().includes(input));
    }

    if (!recipe) return ctx.reply(`❌ Resep "${input}" tidak ditemukan. Ketik <code>/craft</code> untuk lihat daftar.`, { parse_mode: 'HTML' });

    // Cek gold
    if (user.gold < recipe.gold) {
      return ctx.reply(`❌ Gold tidak cukup! Butuh ${recipe.gold}g. Saldo: ${user.gold}g.`);
    }

    // Cek material
    const missing = [];
    for (const mat of recipe.materials) {
      const invItem = getItem(userId, mat.item);
      const have = invItem ? invItem.quantity : 0;
      if (have < mat.qty) {
        missing.push(`${mat.qty}x ${mat.item.replace(/_/g, ' ')} (punya: ${have})`);
      }
    }

    if (missing.length > 0) {
      return ctx.reply(`❌ Material tidak cukup!\n\nYang kurang:\n${missing.map(m => `• ${m}`).join('\n')}`);
    }

    // Craft! (atomic transaction)
    const craftSuccess = db.transaction(() => {
      // Kurangi gold
      if (!spendGold(userId, recipe.gold)) return false;
      // Kurangi material
      for (const mat of recipe.materials) {
        if (!removeItem(userId, mat.item, mat.qty)) return false;
      }
      // Tambah hasil — cek inventory cap
      if (!addItem(userId, recipe.result)) return false;
      return true;
    })();

    if (!craftSuccess) {
      return ctx.reply('❌ Gagal crafting! Inventory penuh atau material tidak cukup.');
    }

    invCache.delete(userId.toString());
    const catalog = getCatalogItem(recipe.result);
    const rarity = catalog ? RARITY_EMOJI[catalog.rarity] || '' : '';
    ctx.reply(`⚒️ <b>Crafting Berhasil!</b>\n\n${rarity} ${recipe.name} sudah masuk inventory!\n💰 Biaya: ${recipe.gold}g`, { parse_mode: 'HTML' });
    incrementQuestProgress(userId, 'craft');
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
    } else if (effect.energy_restore) {
      const currentEnergy = getCurrentEnergy(user);
      const newEnergy = Math.min(10, currentEnergy + effect.energy_restore);
      // Update energy directly
      const now = Math.floor(Date.now() / 1000);
      db.prepare('UPDATE rpg_users SET energy_current = ?, energy_last_update = ?, updated_at = ? WHERE telegram_user_id = ?')
        .run(newEnergy, now, now, userId.toString());
      msg += `⚡ Energi dipulihkan +${effect.energy_restore} (${newEnergy}/10)`;
    } else {
      msg += `Efek tidak diketahui.`;
    }

    removeItem(userId, itemId, 1);
    invCache.delete(userId.toString());
    ctx.reply(msg, { parse_mode: 'HTML' });
    incrementQuestProgress(userId, 'use');
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

    const settings = getGameSettings();
    const dailyConfig = settings.daily_reward;
    
    // Claim daily
    addGold(userId, dailyConfig.gold);
    addXp(userId, dailyConfig.xp);
    if (dailyConfig.item) {
      addItem(userId, dailyConfig.item);
    }
    db.prepare('UPDATE rpg_users SET last_daily_claim_at = ? WHERE telegram_user_id = ?').run(now, userId.toString());

    let rewardText = `💰 +<b>${dailyConfig.gold}</b> Gold\n✨ +<b>${dailyConfig.xp}</b> XP\n`;
    if (dailyConfig.item) {
      const itemData = getCatalogItem(dailyConfig.item);
      const itemName = itemData ? itemData.display_name : dailyConfig.item.replace(/_/g, ' ');
      rewardText += `📦 +<b>1</b> ${itemName}\n`;
    }

    ctx.reply(
      `<b>🎁 HADIAH HARIAN!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${rewardText}\n` +
      `<i>Kembali lagi dalam 20 jam!</i>`,
      { parse_mode: 'HTML' }
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
    if (!['weapon', 'armor', 'staff', 'accessory'].includes(invItem.category)) return ctx.reply(`❌ Hanya senjata, armor, staff, atau aksesori yang bisa di-upgrade.`);
    if (invItem.upgrade_tier >= 5) return ctx.reply(`⚠️ <b>${invItem.display_name}</b> sudah di tier maksimal (+5)!`, { parse_mode: 'HTML' });

    const currentTier = invItem.upgrade_tier;
    const nextTier = currentTier + 1;
    
    const settings = getGameSettings();
    const upgConfig = settings.upgrade_settings;
    
    const oreNeeded = nextTier <= 3 ? nextTier * upgConfig.base_ore_cost : nextTier * (upgConfig.base_ore_cost - 1);
    const goldNeeded = nextTier <= 3 ? nextTier * upgConfig.base_gold_cost : nextTier * (upgConfig.base_gold_cost * 0.8);
    const statType = invItem.category === 'weapon' || invItem.category === 'staff' ? 'ATK/Magic' : 'DEF';

    // Hitung total ore yang dimiliki
    const oreTypes = upgConfig.allowed_ores || [];
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
    
    const settings = getGameSettings();
    const upgConfig = settings.upgrade_settings;
    
    const oreNeeded = nextTier <= 3 ? nextTier * upgConfig.base_ore_cost : nextTier * (upgConfig.base_ore_cost - 1);
    const goldNeeded = nextTier <= 3 ? nextTier * upgConfig.base_gold_cost : nextTier * (upgConfig.base_gold_cost * 0.8);
    const oreTypes = upgConfig.allowed_ores || [];
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
    const statType = invItem.category === 'weapon' || invItem.category === 'staff' ? 'ATK/Magic' : 'DEF';
    ctx.answerCbQuery('Upgrade berhasil!');
    incrementQuestProgress(userId, 'upgrade');
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
    const subCommand = args[0];

    // /give item [nomor/jumlah] — kirim item ke partner
    if (subCommand === 'item') {
      const itemInput = args[1];
      const qty = parseInt(args[2]) || 1;

      if (!itemInput) return ctx.reply(
        `Penggunaan: <code>/give item [nomor/nama] [jumlah]</code>\n` +
        `Contoh: <code>/give item 1</code> atau <code>/give item daging_mentah 5</code>\n\n` +
        `<i>Tanpa pajak! Item dikirim langsung ke partner.</i>`,
        { parse_mode: 'HTML' }
      );

      const partnerId = getPartnerId(userId);
      if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner dulu (/search).');

      const user = getOrCreateUser(userId);
      if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
      const partner = getOrCreateUser(partnerId);
      if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG.');

      // Resolve item (support numeric ID atau string)
      let itemId;
      const inputNum = parseInt(itemInput);
      if (!isNaN(inputNum) && inputNum > 0) {
        const items = getInventory(userId);
        const item = items[inputNum - 1];
        itemId = item ? item.item_id : null;
      } else {
        itemId = itemInput.toLowerCase();
      }

      if (!itemId) return ctx.reply('❌ Nomor item tidak valid. Ketik /inv dulu untuk refresh daftar.');

      const invItem = getItem(userId, itemId);
      if (!invItem) return ctx.reply('❌ Item tidak ada di inventory.');
      if (invItem.quantity < qty) return ctx.reply(`❌ Hanya punya ${invItem.quantity}x ${invItem.display_name}.`);
      if (invItem.equipped) return ctx.reply('❌ Item sedang di-equip. Lepas dulu dengan /unequip.');

      // Atomic transfer
      const transferSuccess = db.transaction(() => {
        const partnerCheck = db.prepare('SELECT telegram_user_id FROM rpg_users WHERE telegram_user_id = ?').get(partnerId.toString());
        if (!partnerCheck) return false;
        if (!removeItem(userId, itemId, qty)) return false;
        addItem(partnerId, itemId, qty);
        return true;
      })();

      if (!transferSuccess) {
        return ctx.reply('❌ Gagal transfer! Partner belum punya karakter atau item tidak cukup.');
      }

      logTransaction(userId, partnerId, qty, 'give_item');
      ctx.reply(`✅ Berhasil mengirim <b>${qty}x ${invItem.display_name}</b> ke partner!`, { parse_mode: 'HTML' });
      bot.telegram.sendMessage(partnerId, `📦 Kamu menerima <b>${qty}x ${invItem.display_name}</b> dari partner!`, { parse_mode: 'HTML' }).catch(() => {});
      return;
    }

    // /give [jumlah] — kirim gold (existing)
    const amount = parseInt(args[0]);

    if (!amount || amount <= 0) return ctx.reply(
      `Penggunaan:\n` +
      `• <code>/give [jumlah]</code> — Kirim gold (pajak 5%)\n` +
      `• <code>/give item [nomor] [jumlah]</code> — Kirim item (tanpa pajak)`,
      { parse_mode: 'HTML' }
    );

    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner dulu (/search).');

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    const partner = getOrCreateUser(partnerId);
    if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG.');

    const tax = Math.floor(amount * 0.05);
    const received = amount - tax;

    // Atomic: cek partner punya karakter dulu, baru transfer
    const transferSuccess = db.transaction(() => {
      const partnerCheck = db.prepare('SELECT telegram_user_id FROM rpg_users WHERE telegram_user_id = ?').get(partnerId.toString());
      if (!partnerCheck) return false;
      if (!spendGold(userId, amount)) return false;
      addGold(partnerId, received);
      return true;
    })();

    if (!transferSuccess) {
      const freshUser = getOrCreateUser(userId);
      if (!freshUser || freshUser.gold < amount) {
        return ctx.reply(`❌ Gold tidak cukup! Butuh ${amount}g. Saldo: ${user.gold}g.`);
      }
      return ctx.reply('❌ Partnermu belum punya karakter RPG. Minta dia ketik /profile dulu!');
    }

    logTransaction(userId, partnerId, received, 'give_transfer');
    logTransaction(userId, null, tax, 'give_tax');

    ctx.reply(`✅ Berhasil mengirim <b>${received}g</b> ke partner <i>(pajak 5% = ${tax}g)</i>.`, { parse_mode: 'HTML' });
    incrementQuestProgress(userId, 'give');
    bot.telegram.sendMessage(partnerId, `💰 Kamu menerima <b>${received}g</b> dari partner!`, { parse_mode: 'HTML' }).catch(() => {});
  });

  // ===== /trade — Kirim item ke partner (pajak 10%) =====
  bot.command('trade', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const args = ctx.message.text.split(' ').slice(1);
    const input = args[0];
    const qty = parseInt(args[1]) || 1;

    if (!input) return ctx.reply(
      `Penggunaan: <code>/trade [item_id/nomor] [jumlah]</code>\n` +
      `Contoh: <code>/trade daging_mentah 5</code>\n\n` +
      `<i>Pajak 10% (partner dapat 90%)</i>\n` +
      `<i>Hanya material & consumable</i>`,
      { parse_mode: 'HTML' }
    );

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');

    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner (/search).');
    const partner = getOrCreateUser(partnerId);
    if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG.');

    // Resolve item
    const itemId = resolveInvInput(userId, input);
    if (!itemId) return ctx.reply('❌ Nomor item tidak valid. Ketik /inv dulu.');

    const invItem = getItem(userId, itemId);
    if (!invItem) return ctx.reply('❌ Item tidak ada di inventory.');
    if (invItem.quantity < qty) return ctx.reply(`❌ Hanya punya ${invItem.quantity}x ${invItem.display_name}.`);
    if (invItem.equipped) return ctx.reply('❌ Item sedang di-equip. Lepas dulu dengan /unequip.');
    if (!['material', 'consumable'].includes(invItem.category)) {
      return ctx.reply('❌ Hanya material & consumable yang bisa di-trade.');
    }

    // Tax 10%
    const tax = Math.max(1, Math.floor(qty * 0.10));
    const received = qty - tax;

    // Atomic trade
    const tradeSuccess = db.transaction(() => {
      if (!removeItem(userId, itemId, qty)) return false;
      // Cek inventory cap partner
      const partnerCount = db.prepare('SELECT COUNT(*) as cnt FROM rpg_inventory WHERE telegram_user_id = ?').get(partnerId.toString());
      const partnerHasItem = db.prepare('SELECT quantity FROM rpg_inventory WHERE telegram_user_id = ? AND item_id = ?').get(partnerId.toString(), itemId);
      if (!partnerHasItem && partnerCount.cnt >= INVENTORY_CAP) return false;
      addItem(partnerId, itemId, received);
      return true;
    })();

    if (!tradeSuccess) {
      return ctx.reply('❌ Gagal trade! Inventory partner penuh atau item tidak cukup.');
    }

    invCache.delete(userId.toString());
    invCache.delete(partnerId.toString());

    ctx.reply(
      `✅ Trade berhasil!\n` +
      `📦 <b>${invItem.display_name}</b> x${qty}\n` +
      `→ Partner menerima: <b>${received}x</b> (pajak ${tax}x)`,
      { parse_mode: 'HTML' }
    );
    incrementQuestProgress(userId, 'give');
    bot.telegram.sendMessage(partnerId,
      `📦 Kamu menerima <b>${received}x ${invItem.display_name}</b> dari partner!`,
      { parse_mode: 'HTML' }
    ).catch(() => {});
  });

}

const SHOP_ITEMS = getShopConfig();
module.exports = { setupEconomy, SHOP_ITEMS };




