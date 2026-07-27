const { db } = require('../db');
const { getOrCreateUser, getInventory } = require('./db_rpg');
const { createEquipmentService } = require('./services/equipment');
const { orderInventory, resolveNumberedId } = require('./inputResolvers');

const STAT_LABELS = {
  atk: '⚔️ ATK', def: '🛡 DEF', magic_atk: '🔮 Magic',
  max_hp: '❤️ Max HP', crit_rate: '💥 Crit',
  phys_resist: '🛡 Resist Fisik', magic_resist: '✨ Resist Magic',
};
const CATEGORY_LABELS = {
  weapon: 'Senjata', staff: 'Tongkat', armor: 'Armor', accessory: 'Aksesori',
};

function formatNumberId(value, maximumFractionDigits = 0) {
  return Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatStat(statKey, value) {
  const label = STAT_LABELS[statKey] || statKey.replace(/_/g, ' ');
  if (['crit_rate', 'phys_resist', 'magic_resist'].includes(statKey)) {
    return `${label} +${formatNumberId(value * 100, 0)}%`;
  }
  return `${label} +${formatNumberId(value)}`;
}

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

    if (action === 'help') {
      return ctx.reply(
        `<b>📘 PANDUAN EQUIPMENT</b>\n\n` +
        `<b>IP (Item Power)</b> adalah skor untuk membandingkan kekuatan item. ` +
        `IP bukan tambahan damage langsung dan memakai skala ringkas berdasarkan level, rarity, Quality, dan upgrade.\n\n` +
        `<b>Quality</b> adalah kualitas hasil forge 50–100. Quality tinggi memberi IP awal dan tier affix lebih baik.\n\n` +
        `<b>Affix</b> adalah bonus stat acak. <b>Socket</b> dapat diisi gem. ` +
        `<b>Terikat akun</b> berarti gear sudah dipakai dan tidak dapat diperdagangkan.\n\n` +
        `<i>Urutan: forge → bandingkan IP/bonus → equip → upgrade/socket → reforge bila perlu.</i>`,
        { parse_mode: 'HTML' },
      );
    }

    if (action === 'forge') {
      const itemId = resolveInventoryNumber(ctx.chat.id, args[1]);
      if (!itemId) return ctx.reply('Gunakan: /gear forge [nomor equipment dari /inv].');
      const result = equipment.forge(ctx.chat.id, itemId);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `⚒️ <b>${result.item.display_name}</b> berhasil menjadi equipment unik.\n` +
        `💪 Kekuatan: <b>${result.item.item_power} IP</b>\n` +
        `✨ Kualitas: <b>${result.item.quality}/100</b>\n` +
        `🎲 ${result.item.affixes.length} bonus acak · ${result.item.sockets.length} socket\n\n` +
        `<i>Ketik /gear untuk membandingkan dan memasangnya.</i>`,
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
      const materials = result.success
        ? result.materials.map(item => `${item.quantity} ${item.itemId.replace(/_/g, ' ')}`).join(' + ')
        : '';
      return ctx.reply(result.success
        ? `⚒️ Upgrade berhasil: +${result.item.upgrade_tier}, IP ${result.item.item_power}. ` +
          `Biaya ${result.goldCost}g dan ${materials}.`
        : `❌ ${result.reason}`);
    }

    if (action === 'reforge') {
      const instanceId = resolveGearNumber(ctx.chat.id, args[1]);
      if (!instanceId) return ctx.reply('❌ Nomor gear tidak valid. Ketik /gear.');
      const key = `telegram:${ctx.chat.id}:${ctx.message.message_id}:gear_reforge`;
      const result = equipment.reforge(ctx.chat.id, instanceId, key);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      const affixes = result.item.affixes
        .map(affix => formatStat(affix.stat_key, affix.stat_value))
        .join(', ');
      return ctx.reply(`✨ Reforge berhasil (${result.goldCost}g + ${result.catalystCost} Katalis): ${affixes}`);
    }

    if (action === 'salvage') {
      const instanceId = resolveGearNumber(ctx.chat.id, args[1]);
      if (!instanceId) return ctx.reply('❌ Nomor gear tidak valid. Ketik /gear.');
      const item = equipment.getInstance(ctx.chat.id, instanceId);
      if (item.equipped_slot) return ctx.reply('❌ Lepas gear terlebih dahulu sebelum salvage.');
      return ctx.reply(
        `⚠️ Bongkar permanen <b>${item.display_name}</b> +${item.upgrade_tier} (${item.item_power} IP)?\n` +
        `<i>Gear hilang dan berubah menjadi material. Tindakan ini tidak dapat dibatalkan.</i>`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Ya, salvage', callback_data: `gear_salvage:${item.id}` },
              { text: '❌ Batal', callback_data: 'gear_salvage_cancel' },
            ]],
          },
        },
      );
    }

    const items = equipment.list(ctx.chat.id);
    if (!items.length) {
      return ctx.reply('Belum ada equipment unik. Cek loot di /inv lalu gunakan /gear forge [nomor /inv].');
    }
    const pageSize = 6;
    const requestedPage = action === 'page' ? Number(args[1]) : 1;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Number.isInteger(requestedPage)
      ? Math.min(Math.max(requestedPage, 1), totalPages)
      : 1;
    const offset = (page - 1) * pageSize;
    const activeByCategory = new Map(items
      .filter(item => item.equipped_slot)
      .map(item => [item.category, item]));
    const lines = items.slice(offset, offset + pageSize).map((item, pageIndex) => {
      const index = offset + pageIndex;
      const affixes = item.affixes
        .map(affix => formatStat(affix.stat_key, affix.stat_value))
        .join(' · ') || 'Tidak ada bonus acak';
      const sockets = item.sockets.length
        ? item.sockets.map(socket =>
          `Slot ${socket.socket_index}: ${socket.gem_item_id ? socket.gem_item_id.replace(/_/g, ' ') : 'kosong'}`,
        ).join(' · ')
        : 'Tidak memiliki socket';
      const status = item.bind_status === 'account_bound'
        ? '🔒 Terikat akun'
        : '🔓 Bisa diperdagangkan';
      const set = item.set_id ? `\n   🧩 Set: ${item.set_id}` : '';
      const active = activeByCategory.get(item.category);
      const comparison = item.equipped_slot
        ? '✅ Sedang dipakai untuk build aktif'
        : !active
          ? '💡 Slot masih kosong — bisa langsung dipasang'
          : item.item_power > active.item_power
            ? `⬆️ Lebih tinggi +${item.item_power - active.item_power} IP dari equipment aktif`
            : item.item_power < active.item_power
              ? `⬇️ Lebih rendah ${active.item_power - item.item_power} IP dari equipment aktif`
              : '➖ IP setara dengan equipment aktif — bandingkan bonus stat';
      return `${item.equipped_slot ? '✅ TERPASANG' : '▫️ TERSIMPAN'}  <code>[${index + 1}]</code> <b>${item.display_name}</b>\n` +
        `   ${CATEGORY_LABELS[item.category] || item.category} · ${item.rarity} · Item Lv.${item.item_level} · Upgrade +${item.upgrade_tier}\n` +
        `   💪 <b>${item.item_power} IP</b> · ✨ Kualitas <b>${item.quality}/100</b>\n` +
        `   🎲 ${affixes}\n` +
        `   💎 ${sockets}\n` +
        `   ${status}${set}\n` +
        `   ${comparison}\n` +
        `   ➡️ /gear equip ${index + 1} · /gear upgrade ${index + 1} · /gear reforge ${index + 1} · /gear salvage ${index + 1}`;
    });
    return ctx.reply(
      `<b>🛡 EQUIPMENT</b>\n` +
      `<i>Gear unik dengan IP, kualitas, bonus acak, socket, dan set. Halaman ${page}/${totalPages}.</i>\n\n` +
      `${lines.join('\n\n')}\n\n` +
      `<b>💡 Apa itu IP/Quality?</b> Ketik /gear help\n` +
      `<i>/equip [nomor] · /upgrade [nomor] memakai nomor yang sama dengan /gear\n` +
      `Forge loot equipment: /gear forge [nomor equipment dari /inv]\n` +
      `Gem: /gear socket [gear] [slot] [nomor gem /inv]` +
      `${totalPages > 1 ? `\nHalaman: /gear page [1-${totalPages}]` : ''}</i>`,
      { parse_mode: 'HTML' },
    );
  });

  bot.command('equip', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter dahulu dengan /profile.');
    const input = ctx.message.text.trim().split(/\s+/)[1];
    if (!input) return ctx.reply('Buka /gear, lalu gunakan /equip [nomor].');
    const instanceId = resolveGearNumber(ctx.chat.id, input);
    if (!instanceId) return ctx.reply('❌ Nomor equipment tidak valid. Buka /gear.');
    const result = equipment.equip(ctx.chat.id, instanceId);
    return ctx.reply(result.success
      ? `✅ ${result.item.display_name} dipasang di slot ${result.item.equipped_slot}.`
      : `❌ ${result.reason}`);
  });

  bot.command('unequip', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter dahulu dengan /profile.');
    const slot = ctx.message.text.trim().split(/\s+/)[1]?.toLowerCase();
    if (!slot) return ctx.reply('Gunakan /unequip [weapon/staff/armor/accessory].');
    const result = equipment.unequip(ctx.chat.id, slot);
    return ctx.reply(result.success
      ? `✅ ${result.item.display_name} dilepas dari slot ${slot}.`
      : `❌ ${result.reason}`);
  });

  bot.command('upgrade', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) return ctx.reply('Buat karakter dahulu dengan /profile.');
    const input = ctx.message.text.trim().split(/\s+/)[1];
    if (!input) return ctx.reply('Buka /gear, lalu gunakan /upgrade [nomor].');
    const instanceId = resolveGearNumber(ctx.chat.id, input);
    if (!instanceId) return ctx.reply('❌ Nomor equipment tidak valid. Buka /gear.');
    const key = `telegram:${ctx.chat.id}:${ctx.message.message_id}:equipment_upgrade`;
    const result = equipment.upgrade(ctx.chat.id, instanceId, key);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    const ore = result.materials.find(item => item.itemId === 'ore_upgrade')?.quantity || 0;
    return ctx.reply(
      `⚒️ ${result.item.display_name} berhasil menjadi +${result.item.upgrade_tier}.\n` +
      `💪 IP ${result.item.item_power} · biaya ${result.goldCost}g + ${ore} Ore Upgrade.\n` +
      `✅ /profile langsung memakai peningkatan ini.`,
    );
  });

  bot.action('gear_salvage_cancel', async ctx => {
    await ctx.answerCbQuery('Salvage dibatalkan.');
    return ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
  });

  bot.action(/^gear_salvage:(\d+)$/, async ctx => {
    const instanceId = Number(ctx.match[1]);
    const key = `telegram:${ctx.chat.id}:${ctx.callbackQuery.id}:gear_salvage`;
    const result = equipment.salvage(ctx.chat.id, instanceId, key);
    await ctx.answerCbQuery(result.success ? 'Gear berhasil dibongkar.' : result.reason);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    const rewards = Object.entries(result.rewards)
      .map(([itemId, quantity]) => `${quantity}× ${itemId.replace(/_/g, ' ')}`)
      .join(' · ');
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    return ctx.reply(`♻️ Salvage berhasil. Diperoleh: ${rewards}.`);
  });
}

module.exports = { setupEquipment, formatNumberId, formatStat };
