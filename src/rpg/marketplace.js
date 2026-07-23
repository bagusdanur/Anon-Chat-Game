const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const { createMarketplaceService } = require('./services/marketplace');

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
      const itemId = args[1];
      const quantity = Number(args[2]);
      const unitPrice = Number(args[3]);
      if (!itemId || !Number.isInteger(quantity) || !Number.isInteger(unitPrice)) {
        return ctx.reply('Gunakan: /market sell [item_id] [qty] [harga_satuan]');
      }
      const result = market.createListing(ctx.chat.id, itemId, quantity, unitPrice);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `✅ Listing #${result.listingId} dibuat.\n` +
        `${result.item} ×${quantity} · ${unitPrice}g/item · berlaku 48 jam.`,
      );
    }

    if (action === 'buy') {
      const listingId = Number(args[1]);
      if (!Number.isInteger(listingId)) return ctx.reply('Gunakan: /market buy [listing_id]');
      const result = market.buy(ctx.chat.id, listingId);
      if (!result.success) return ctx.reply(`❌ ${result.reason}`);
      return ctx.reply(
        `🛒 Pembelian berhasil!\n${result.item} ×${result.quantity}\n` +
        `Total: ${result.gross}g (termasuk pajak market ${result.tax}g).`,
      );
    }

    if (action === 'cancel') {
      const listingId = Number(args[1]);
      if (!Number.isInteger(listingId)) return ctx.reply('Gunakan: /market cancel [listing_id]');
      const result = market.cancel(ctx.chat.id, listingId);
      return ctx.reply(result.success ? '✅ Listing dibatalkan dan item kembali.' : `❌ ${result.reason}`);
    }

    const itemFilter = action || null;
    const listings = market.browse({ itemId: itemFilter, limit: 20 });
    if (listings.length === 0) return ctx.reply('Marketplace belum memiliki listing aktif.');
    const lines = listings.map(listing =>
      `#<b>${listing.id}</b> ${listing.display_name} ×${listing.quantity}\n` +
      `   ${listing.unit_price}g/item · penjual anonim`,
    );
    return ctx.reply(
      `<b>🏪 CONTROLLED MARKETPLACE</b>\n\n${lines.join('\n\n')}\n\n` +
      `<i>/market buy [id]\n/market sell [item] [qty] [harga]\n/market cancel [id]</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupMarketplace };
