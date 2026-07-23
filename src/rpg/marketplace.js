const { db } = require('../db');
const { getOrCreateUser, getInventory } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { createMarketplaceService } = require('./services/marketplace');
const { orderInventory } = require('./inputResolvers');

function setupMarketplace(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  const market = createMarketplaceService(db);

  function requireMarket(ctx) {
    if (!flags.isEnabled('marketplace_v2')) {
      ctx.reply('🛠 Marketplace sedang dinonaktifkan sementara.');
      return false;
    }
    if (!getOrCreateUser(ctx.chat.id)) {
      ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
      return false;
    }
    return true;
  }

  bot.command('market', rateLimitCommand, ctx => {
    if (!requireMarket(ctx)) return;
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    const action = args[0]?.toLowerCase();

    if (action === 'sell') {
      const inventory = orderInventory(getInventory(ctx.chat.id));
      const itemNumber = Number(args[1]);
      const itemId = Number.isInteger(itemNumber) && itemNumber >= 1
        ? inventory[itemNumber - 1]?.item_id
        : args[1];
      const quantity = Number(args[2]);
      const unitPrice = Number(args[3]);
      if (!itemId || !Number.isInteger(quantity) || !Number.isInteger(unitPrice)) {
        return ctx.reply('Gunakan: /market sell [nomor dari /inv] [qty] [harga_satuan]');
      }
      const result = market.createListing(ctx.chat.id, itemId, quantity, unitPrice);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `✅ Listing berhasil dibuat.\n` +
        `${result.item} ×${quantity} · ${unitPrice}g/item · berlaku 48 jam.`,
      );
    }

    if (action === 'buy') {
      const listings = market.browse({ limit: 20 });
      const listingId = listings[Number(args[1]) - 1]?.id;
      if (!listingId) return ctx.reply('Gunakan: /market buy [nomor dari /market]');
      const result = market.buy(ctx.chat.id, listingId);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `🛒 Pembelian berhasil!\n${result.item} ×${result.quantity}\n` +
        `Total: ${result.gross}g (termasuk pajak market ${result.tax}g).`,
      );
    }

    if (action === 'cancel') {
      const listings = market.browse({ limit: 20 });
      const listingId = listings[Number(args[1]) - 1]?.id;
      if (!listingId) return ctx.reply('Gunakan: /market cancel [nomor dari /market]');
      const result = market.cancel(ctx.chat.id, listingId);
      return ctx.reply(result.success ? '✅ Listing dibatalkan dan item kembali.' : `❌ ${result.reason}`);
    }

    const itemFilter = action || null;
    const listings = market.browse({ itemId: itemFilter, limit: 20 });
    if (listings.length === 0) {
      return ctx.reply(
        '<b>🏪 MARKETPLACE</b>\n\nBelum ada listing aktif.\n\n' +
        '<i>💡 Buka /inv, lalu jual dengan /market sell [nomor] [qty] [harga].</i>',
        { parse_mode: 'HTML' },
      );
    }
    const lines = listings.map((listing, index) =>
      `<code>[${index + 1}]</code> <b>${listing.display_name}</b> ×${listing.quantity}\n` +
      `   ${listing.unit_price}g/item · penjual anonim`,
    );
    return ctx.reply(
      `<b>🏪 CONTROLLED MARKETPLACE</b>\n\n${lines.join('\n\n')}\n\n` +
      `<i>/market buy [nomor]\n/market sell [nomor /inv] [qty] [harga]\n` +
      `/market cancel [nomor]\n\n💡 Nomor mengikuti daftar /market terbaru.</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupMarketplace };
