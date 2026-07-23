const { db } = require('../db');
const {
  getOrCreateUser, getCurrentEnergy, spendEnergy, addItem, getItem, removeItem,
} = require('./db_rpg');
const { createProfessionService, professionXpToNext } = require('./services/professions');

function setupProfessions(bot, { rateLimitCommand }) {
  const professions = createProfessionService(db);

  bot.command('profession', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const lines = professions.list(ctx.chat.id).map(item =>
      `${item.name} Lv.<b>${item.level}</b> · ${item.xp}/${professionXpToNext(item.level)} XP · Mastery ${item.mastery}`,
    );
    return ctx.reply(`<b>🧰 PROFESSIONS</b>\n\n${lines.join('\n')}`, { parse_mode: 'HTML' });
  });

  bot.command('gather', rateLimitCommand, ctx => {
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const activity = ctx.message.text.trim().split(/\s+/)[1]?.toLowerCase() || 'herb';
    if (!['herb', 'herbalism'].includes(activity)) {
      return ctx.reply('Saat ini gathering manual tersedia: /gather herb');
    }
    const energy = getCurrentEnergy(user);
    if (energy < 1) return ctx.reply('⚡ Butuh 1 energi untuk mencari tanaman.');
    spendEnergy(ctx.chat.id, 1);
    const roll = Math.random();
    const itemId = roll < 0.7 ? 'daging_mentah' : roll < 0.95 ? 'ramuan_kecil' : 'ramuan_besar';
    addItem(ctx.chat.id, itemId);
    const result = professions.grantXp(
      ctx.chat.id, 'herbalism', 8,
      `telegram:${ctx.update.update_id}:herbalism`,
    );
    return ctx.reply(
      `🌿 Gathering selesai!\n🎁 ${itemId.replace(/_/g, ' ')}\n` +
      `✨ Herbalism +8 XP${result.levelsGained ? ` · Level ${result.level}!` : ''}`,
    );
  });

  bot.command('salvage', rateLimitCommand, ctx => {
    const userId = ctx.chat.id;
    if (!getOrCreateUser(userId)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const itemId = ctx.message.text.trim().split(/\s+/)[1];
    if (!itemId) return ctx.reply('Gunakan: /salvage [item_id]');
    const item = getItem(userId, itemId);
    if (!item || !['weapon', 'staff', 'armor', 'accessory'].includes(item.category)) {
      return ctx.reply('❌ Equipment tidak ditemukan.');
    }
    if (item.equipped) return ctx.reply('❌ Lepas equipment terlebih dahulu.');
    const materialByRarity = {
      common: ['besi_rongsok', 1], uncommon: ['besi_rongsok', 2],
      rare: ['besi', 2], epic: ['perak', 2], legendary: ['emas_ore', 2],
    };
    const [material, quantity] = materialByRarity[item.rarity] || ['besi_rongsok', 1];
    const success = db.transaction(() => {
      if (!removeItem(userId, itemId, 1)) return false;
      if (!addItem(userId, material, quantity)) throw new Error('Inventory penuh');
      return true;
    })();
    if (!success) return ctx.reply('❌ Salvage gagal.');
    professions.grantXp(userId, 'smithing', 12, `telegram:${ctx.update.update_id}:salvage`);
    return ctx.reply(`♻️ ${item.display_name} di-salvage menjadi ${quantity}x ${material.replace(/_/g, ' ')}.`);
  });

  bot.command('refine', rateLimitCommand, ctx => {
    const userId = ctx.chat.id;
    if (!getOrCreateUser(userId)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const input = ctx.message.text.trim().split(/\s+/)[1];
    const recipes = {
      tembaga: 'besi', besi: 'perak', perak: 'emas_ore',
    };
    const output = recipes[input];
    if (!output) return ctx.reply('Gunakan: /refine tembaga|besi|perak (butuh 5 material)');
    const source = getItem(userId, input);
    if (!source || source.quantity < 5) return ctx.reply(`❌ Butuh 5x ${input}.`);
    db.transaction(() => {
      if (!removeItem(userId, input, 5)) throw new Error('Material berubah');
      if (!addItem(userId, output, 1)) throw new Error('Inventory penuh');
    })();
    const result = professions.grantXp(userId, 'smithing', 15, `telegram:${ctx.update.update_id}:refine`);
    return ctx.reply(`🔥 Refinement berhasil: 5x ${input} → 1x ${output}${result.levelsGained ? `\n🔨 Smithing Lv.${result.level}!` : ''}`);
  });
}

module.exports = { setupProfessions };
