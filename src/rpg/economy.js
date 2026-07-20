// src/rpg/economy.js
// Fase 3 & 4: /inv, /shop, /buy, /sell, /daily, /craft, /upgrade, /give
const { Markup } = require('telegraf');
const { db } = require('../db');
const {
  getOrCreateUser, getInventory, getItem, removeItem, addItem,
  spendGold, addGold, getCatalogItem, upgradeItem, updateHp,
  getCurrentHp, logTransaction, addXp,
  incrementQuestProgress,
  equipItem, unequipSlot, getEquipped, getEquippedBonus
} = require('./db_rpg');
const { RARITY_EMOJI } = require('./profile');

// ID numerik statis untuk shop (1-indexed, tidak berubah)
const SHOP_ITEMS = [
  { id: 1, item_id: 'ramuan_kecil',  buy_price: 15  },
  { id: 2, item_id: 'ramuan_besar',  buy_price: 50  },
  { id: 3, item_id: 'ramuan_energi', buy_price: 75  },
  { id: 4, item_id: 'kail_plus',     buy_price: 200 },
  { id: 5, item_id: 'beliung_plus',  buy_price: 300 },
  { id: 6, item_id: 'pedang_karatan',buy_price: 150 },
  { id: 7, item_id: 'tongkat_ranting',buy_price: 80 },
  { id: 8, item_id: 'jubah_terkutuk',buy_price: 200 },
  { id: 9, item_id: 'cincin_perak',  buy_price: 100 },
  { id: 10, item_id: 'amulet_pertahanan', buy_price: 150 },
];

// ===== CRAFTING RECIPES =====
const CRAFT_RECIPES = [
  // Weapons
  { id: 1, result: 'pedang_besi', name: '🗡️ Pedang Besi', gold: 100,
    materials: [{ item: 'besi', qty: 3 }, { item: 'tembaga', qty: 3 }] },
  { id: 2, result: 'pedang_naga', name: '🐉 Pedang Naga', gold: 500,
    materials: [{ item: 'besi', qty: 10 }, { item: 'fragmen_naga', qty: 5 }, { item: 'sisik_naga', qty: 3 }] },
  // Staffs
  { id: 3, result: 'tongkat_ranting', name: '🪄 Tongkat Ranting', gold: 50,
    materials: [{ item: 'batu_bara', qty: 3 }, { item: 'tembaga', qty: 2 }] },
  { id: 4, result: 'tongkat_api', name: '🔥 Tongkat Api', gold: 150,
    materials: [{ item: 'batu_bara', qty: 8 }, { item: 'perak', qty: 3 }] },
  { id: 5, result: 'tongkat_es', name: '❄️ Tongkat Es', gold: 400,
    materials: [{ item: 'perak', qty: 8 }, { item: 'berlian', qty: 5 }] },
  // Armor
  { id: 6, result: 'perisai_besi', name: '🛡️ Perisai Besi', gold: 120,
    materials: [{ item: 'besi', qty: 5 }, { item: 'kulit_kasar', qty: 5 }] },
  { id: 7, result: 'jubah_terkutuk', name: '🧥 Jubah Terkutuk', gold: 300,
    materials: [{ item: 'perak', qty: 5 }, { item: 'emas_ore', qty: 2 }] },
  { id: 8, result: 'armor_naga', name: '🐉 Armor Naga', gold: 600,
    materials: [{ item: 'emas_ore', qty: 5 }, { item: 'fragmen_naga', qty: 8 }, { item: 'sisik_naga', qty: 5 }] },
  // Accessories
  { id: 9, result: 'cincin_perak', name: '💍 Cincin Perak', gold: 60,
    materials: [{ item: 'perak', qty: 3 }, { item: 'mutiara', qty: 1 }] },
  { id: 10, result: 'cincin_keberuntungan', name: '💍 Cincin Keberuntungan', gold: 200,
    materials: [{ item: 'perak', qty: 5 }, { item: 'mutiara', qty: 3 }] },
  { id: 11, result: 'kalung_kekuatan', name: '📿 Kalung Kekuatan', gold: 180,
    materials: [{ item: 'emas_ore', qty: 2 }, { item: 'perak', qty: 4 }] },
  { id: 12, result: 'kalung_naga', name: '🐉 Kalung Naga', gold: 500,
    materials: [{ item: 'emas_ore', qty: 5 }, { item: 'fragmen_naga', qty: 3 }, { item: 'berlian', qty: 2 }] },
  // Consumables
  { id: 13, result: 'ramuan_kecil', name: '🧪 Ramuan Kecil', gold: 5,
    materials: [{ item: 'daging_mentah', qty: 3 }] },
  { id: 14, result: 'ramuan_besar', name: '🧪 Ramuan Besar', gold: 20,
    materials: [{ item: 'daging_mentah', qty: 8 }, { item: 'ikan_salmon', qty: 2 }] },
];

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

    // Tanpa argumen → tampilkan daftar resep
    if (!input) {
      let msg = `⚒️ <b>Tukang Crafts — Resep Crafting</b>\n\n`;
      msg += `Gunakan: <code>/craft [nama]</code> atau <code>/craft [nomor]</code>\n\n`;

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
      // Tambah hasil
      addItem(userId, recipe.result);
      return true;
    })();

    if (!craftSuccess) {
      return ctx.reply('❌ Gagal crafting! Terjadi kesalahan.');
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

    // Claim daily — balance: 80g + 25xp + 1 ramuan = wajar untuk casual
    addGold(userId, 80);
    addXp(userId, 25);
    addItem(userId, 'ramuan_kecil');
    const { db } = require('../db');
    db.prepare('UPDATE rpg_users SET last_daily_claim_at = ? WHERE telegram_user_id = ?').run(now, userId.toString());

    ctx.reply(
      `<b>🎁 HADIAH HARIAN!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💰 +<b>80</b> Gold\n` +
      `✨ +<b>25</b> XP\n` +
      `🧪 +<b>1</b> Ramuan Kecil\n\n` +
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
    const oreNeeded = nextTier <= 3 ? nextTier * 3 : nextTier * 2;
    const goldNeeded = nextTier <= 3 ? nextTier * 100 : nextTier * 80;
    const statType = invItem.category === 'weapon' || invItem.category === 'staff' ? 'ATK/Magic' : 'DEF';

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
    const oreNeeded = nextTier <= 3 ? nextTier * 3 : nextTier * 2;
    const goldNeeded = nextTier <= 3 ? nextTier * 100 : nextTier * 80;
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

    // Atomic: cek partner punya karakter dulu, baru transfer
    const transferSuccess = db.transaction(() => {
      // Pastikan partner ada di rpg_users sebelum addGold
      const partnerCheck = db.prepare('SELECT telegram_user_id FROM rpg_users WHERE telegram_user_id = ?').get(partnerId.toString());
      if (!partnerCheck) return false;
      if (!spendGold(userId, amount)) return false;
      addGold(partnerId, received);
      return true;
    })();

    if (!transferSuccess) {
      // Cek apakah gagal karena gold kurang atau partner tidak punya karakter
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




}




module.exports = { setupEconomy, SHOP_ITEMS };
