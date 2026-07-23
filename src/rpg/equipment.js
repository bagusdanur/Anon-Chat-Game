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

function formatNumberId(value, maximumFractionDigits = 2) {
  return Number(value).toLocaleString('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
}

function formatStat(statKey, value) {
  const label = STAT_LABELS[statKey] || statKey.replace(/_/g, ' ');
  if (['crit_rate', 'phys_resist', 'magic_resist'].includes(statKey)) {
    return `${label} +${formatNumberId(value * 100, 1)}%`;
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
        `<b>📘 PANDUAN EQUIPMENT V2</b>\n\n` +
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
      if (!itemId) return ctx.reply('Gunakan: /gear forge [nomor dari /inv]');
      const result = equipment.forge(ctx.chat.id, itemId);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `⚒️ <b>${result.item.display_name}</b> berhasil ditempa menjadi Equipment V2.\n` +
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
        .map(affix => formatStat(affix.stat_key, affix.stat_value))
        .join(', ');
      return ctx.reply(`✨ Reforge berhasil (${result.goldCost}g): ${affixes}`);
    }

    const items = equipment.list(ctx.chat.id);
    if (!items.length) {
      return ctx.reply('Belum ada Equipment V2. Buka /inv lalu gunakan /gear forge [nomor].');
    }
    const pageSize = 6;
    const requestedPage = action === 'page' ? Number(args[1]) : 1;
    const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
    const page = Number.isInteger(requestedPage)
      ? Math.min(Math.max(requestedPage, 1), totalPages)
      : 1;
    const offset = (page - 1) * pageSize;
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
      return `${item.equipped_slot ? '✅ TERPASANG' : '▫️ TERSIMPAN'}  <code>[${index + 1}]</code> <b>${item.display_name}</b>\n` +
        `   ${CATEGORY_LABELS[item.category] || item.category} · ${item.rarity} · Upgrade +${item.upgrade_tier}\n` +
        `   💪 <b>${item.item_power} IP</b> · ✨ Kualitas <b>${item.quality}/100</b>\n` +
        `   🎲 ${affixes}\n` +
        `   💎 ${sockets}\n` +
        `   ${status}${set}\n` +
        `   ➡️ /gear equip ${index + 1} · /gear upgrade ${index + 1} · /gear reforge ${index + 1}`;
    });
    return ctx.reply(
      `<b>🛡 EQUIPMENT V2</b>\n` +
      `<i>Gear unik dengan IP, kualitas, bonus acak, socket, dan set. Halaman ${page}/${totalPages}.</i>\n\n` +
      `${lines.join('\n\n')}\n\n` +
      `<b>💡 Apa itu IP/Quality?</b> Ketik /gear help\n` +
      `<i>Forge: /gear forge [nomor /inv]\n` +
      `Gem: /gear socket [gear] [slot] [nomor gem /inv]` +
      `${totalPages > 1 ? `\nHalaman: /gear page [1-${totalPages}]` : ''}</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupEquipment, formatNumberId, formatStat };
