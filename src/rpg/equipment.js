const { db } = require('../db');
const { getOrCreateUser, getInventory } = require('./db_rpg');
const { createEquipmentService } = require('./services/equipment');
const { orderInventory, resolveNumberedId } = require('./inputResolvers');

function setupEquipment(bot, { rateLimitCommand }) {
  const equipment = createEquipmentService(db);

  function resolveGearNumber(userId, input) {
    return resolveNumberedId(equipment.list(userId), input);
  }

  function resolveInventoryNumber(userId, input) {
    const items = orderInventory(getInventory(userId));
    const number = Number(input);
    if (Number.isInteger(number) && number >= 1) {
      return items[number - 1]?.item_id || null;
    }
    return input || null;
  }

  bot.command('gear', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) {
      return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    }
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    const action = args[0]?.toLowerCase();

    if (action === 'forge') {
      const itemId = resolveInventoryNumber(ctx.chat.id, args[1]);
      if (!itemId) return ctx.reply('Gunakan: /gear forge [nomor dari /inv]');
      const result = equipment.forge(ctx.chat.id, itemId);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `⚒️ <b>${result.item.display_name}</b> berhasil ditempa menjadi Equipment V2.\n` +
        `Item Power <b>${result.item.item_power}</b> · Quality <b>${result.item.quality}</b> · ` +
        `${result.item.affixes.length} affix · ${result.item.sockets.length} socket.\n` +
        `Ketik /gear untuk melihat nomornya.`,
        { parse_mode: 'HTML' },
      );
    }

    if (action === 'equip') {
      const instanceId = resolveGearNumber(ctx.chat.id, args[1]);
      if (!instanceId) return ctx.reply('❌ Nomor gear tidak valid. Ketik /gear.');
      const result = equipment.equip(ctx.chat.id, instanceId);
      return ctx.reply(result.success
        ? `✅ ${result.item.display_name} dipasang dan menjadi account-bound.`
        : `❌ ${result.reason}`);
    }

    if (action === 'socket') {
      const instanceId = resolveGearNumber(ctx.chat.id, args[1]);
      const gemItemId = resolveInventoryNumber(ctx.chat.id, args[3]);
      if (!instanceId || !gemItemId) {
        return ctx.reply('Gunakan: /gear socket [nomor gear] [slot socket] [nomor gem dari /inv]');
      }
      const result = equipment.socketGem(ctx.chat.id, instanceId, Number(args[2]), gemItemId);
      return ctx.reply(result.success ? '💎 Gem berhasil dipasang.' : `❌ ${result.reason}`);
    }

    if (action === 'upgrade') {
      const instanceId = resolveGearNumber(ctx.chat.id, args[1]);
      if (!instanceId) return ctx.reply('❌ Nomor gear tidak valid. Ketik /gear.');
      const key = `telegram:${ctx.chat.id}:${ctx.message.message_id}:gear_upgrade`;
      const result = equipment.upgrade(ctx.chat.id, instanceId, key);
      return ctx.reply(result.success
        ? `⚒️ Upgrade berhasil: +${result.item.upgrade_tier}, IP ${result.item.item_power}. ` +
          `Biaya ${result.goldCost}g dan ${result.materialCost} Tembaga.`
        : `❌ ${result.reason}`);
    }

    if (action === 'reforge') {
      const instanceId = resolveGearNumber(ctx.chat.id, args[1]);
      if (!instanceId) return ctx.reply('❌ Nomor gear tidak valid. Ketik /gear.');
      const key = `telegram:${ctx.chat.id}:${ctx.message.message_id}:gear_reforge`;
      const result = equipment.reforge(ctx.chat.id, instanceId, key);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      const affixes = result.item.affixes
        .map(affix => `${affix.stat_key} +${affix.stat_value}`)
        .join(', ');
      return ctx.reply(`✨ Reforge berhasil (${result.goldCost}g): ${affixes}`);
    }

    const items = equipment.list(ctx.chat.id);
    if (!items.length) {
      return ctx.reply('Belum ada Equipment V2. Buka /inv lalu gunakan /gear forge [nomor].');
    }
    const lines = items.map((item, index) => {
      const affixes = item.affixes
        .map(affix => `${affix.stat_key} +${affix.stat_value}`)
        .join(', ') || 'tanpa affix';
      const sockets = item.sockets
        .map(socket => socket.gem_item_id || 'kosong')
        .join(', ') || 'tanpa socket';
      return `${item.equipped_slot ? '✅' : '▫️'} <code>[${index + 1}]</code> <b>${item.display_name}</b>\n` +
        `   IP ${item.item_power} · Q${item.quality} · ${item.bind_status}\n` +
        `   ${affixes} · socket: ${sockets}`;
    });
    return ctx.reply(
      `<b>🛡 EQUIPMENT V2</b>\n\n${lines.join('\n\n')}\n\n` +
      `<i>/gear forge [nomor /inv] · /gear equip [nomor gear]\n` +
      `/gear socket [gear] [slot] [nomor gem /inv]\n` +
      `/gear upgrade [nomor gear] · /gear reforge [nomor gear]</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupEquipment };
