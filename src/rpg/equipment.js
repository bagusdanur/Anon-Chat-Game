const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createEquipmentService } = require('./services/equipment');

function setupEquipment(bot, { rateLimitCommand }) {
  const equipment = createEquipmentService(db);

  bot.command('gear', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    const action = args[0]?.toLowerCase();
    if (action === 'forge') {
      const result = equipment.forge(ctx.chat.id, args[1]);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `⚒️ <b>${result.item.display_name}</b> menjadi equipment instance #${result.item.id}.\n` +
        `Item Power <b>${result.item.item_power}</b> · Quality <b>${result.item.quality}</b> · ` +
        `${result.item.affixes.length} affix · ${result.item.sockets.length} socket.`,
        { parse_mode: 'HTML' },
      );
    }
    if (action === 'equip') {
      const result = equipment.equip(ctx.chat.id, Number(args[1]));
      return ctx.reply(result.success
        ? `✅ ${result.item.display_name} dipasang dan menjadi account-bound.`
        : `❌ ${result.reason}`);
    }
    if (action === 'socket') {
      const result = equipment.socketGem(ctx.chat.id, Number(args[1]), Number(args[2]), args[3]);
      return ctx.reply(result.success ? '💎 Gem berhasil dipasang.' : `❌ ${result.reason}`);
    }
    const items = equipment.list(ctx.chat.id);
    if (!items.length) {
      return ctx.reply('Belum ada equipment v2. Gunakan /gear forge [item_id] untuk mengonversi equipment lama.');
    }
    const lines = items.map(item => {
      const affixes = item.affixes.map(affix => `${affix.stat_key} +${affix.stat_value}`).join(', ') || 'tanpa affix';
      const sockets = item.sockets.map(socket => socket.gem_item_id || 'kosong').join(', ') || 'tanpa socket';
      return `${item.equipped_slot ? '✅' : '▫️'} <b>#${item.id} ${item.display_name}</b>\n` +
        `   IP ${item.item_power} · Q${item.quality} · ${item.bind_status}\n` +
        `   ${affixes} · socket: ${sockets}`;
    });
    return ctx.reply(
      `<b>🛡 EQUIPMENT V2</b>\n\n${lines.join('\n\n')}\n\n` +
      `<i>/gear forge [item_id] · /gear equip [instance_id] · ` +
      `/gear socket [instance_id] [slot] [gem_id]</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupEquipment };
