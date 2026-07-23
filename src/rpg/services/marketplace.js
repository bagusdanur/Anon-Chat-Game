const { createLedgerService } = require('./ledger');

const MARKET_TAX_RATE = 0.05;
const LISTING_TTL_SECONDS = 48 * 60 * 60;
const MAX_ACTIVE_LISTINGS = 10;

function createMarketplaceService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const ledger = createLedgerService(db);

  function returnEscrow(listing, status) {
    db.prepare(`
      INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity, upgrade_tier)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(telegram_user_id, item_id)
      DO UPDATE SET quantity = quantity + excluded.quantity
    `).run(listing.seller_id, listing.item_id, listing.quantity, listing.upgrade_tier);
    db.prepare(`
      UPDATE rpg_market_listings SET status = ?, completed_at = ?
      WHERE id = ? AND status = 'active'
    `).run(status, now(), listing.id);
  }

  function expireListings() {
    const expired = db.prepare(`
      SELECT * FROM rpg_market_listings
      WHERE status = 'active' AND expires_at <= ?
    `).all(now());
    db.transaction(() => expired.forEach(listing => returnEscrow(listing, 'expired')))();
    return expired.length;
  }

  function priceBounds(item) {
    const base = Math.max(1, item.sell_price || 1);
    return { min: base, max: Math.max(100, base * 20) };
  }

  return {
    expireListings,
    priceBounds,
    browse({ itemId = null, limit = 20 } = {}) {
      expireListings();
      if (itemId) {
        return db.prepare(`
          SELECT l.*, c.display_name, c.rarity, c.category
          FROM rpg_market_listings l JOIN items_catalog c ON c.item_id = l.item_id
          WHERE l.status = 'active' AND l.item_id = ?
          ORDER BY l.unit_price, l.created_at LIMIT ?
        `).all(itemId, Math.min(Math.max(limit, 1), 50));
      }
      return db.prepare(`
        SELECT l.*, c.display_name, c.rarity, c.category
        FROM rpg_market_listings l JOIN items_catalog c ON c.item_id = l.item_id
        WHERE l.status = 'active'
        ORDER BY l.created_at DESC LIMIT ?
      `).all(Math.min(Math.max(limit, 1), 50));
    },
    createListing(userId, itemId, quantity, unitPrice) {
      const uid = String(userId);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return { success: false, reason: 'Quantity harus bilangan positif.' };
      }
      if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
        return { success: false, reason: 'Harga harus bilangan positif.' };
      }
      expireListings();
      const activeCount = db.prepare(`
        SELECT count(1) count FROM rpg_market_listings
        WHERE seller_id = ? AND status = 'active'
      `).get(uid).count;
      if (activeCount >= MAX_ACTIVE_LISTINGS) {
        return { success: false, reason: `Maksimal ${MAX_ACTIVE_LISTINGS} listing aktif.` };
      }
      const inventory = db.prepare(`
        SELECT i.*, c.display_name, c.rarity, c.category, c.sell_price
        FROM rpg_inventory i JOIN items_catalog c ON c.item_id = i.item_id
        WHERE i.telegram_user_id = ? AND i.item_id = ?
      `).get(uid, itemId);
      if (!inventory || inventory.quantity < quantity) {
        return { success: false, reason: 'Item atau quantity tidak tersedia.' };
      }
      if (inventory.equipped) return { success: false, reason: 'Equipment yang dipakai tidak bisa dijual.' };
      if (['weapon', 'staff', 'armor', 'accessory'].includes(inventory.category)) {
        return { success: false, reason: 'Equipment masih bound sampai sistem item-instance dirilis.' };
      }
      if (inventory.sell_price <= 0 || inventory.rarity === 'legendary') {
        return { success: false, reason: 'Item ini bound dan tidak dapat diperdagangkan.' };
      }
      const bounds = priceBounds(inventory);
      if (unitPrice < bounds.min || unitPrice > bounds.max) {
        return { success: false, reason: `Harga diperbolehkan ${bounds.min}-${bounds.max}g per item.` };
      }
      const timestamp = now();
      const listingId = db.transaction(() => {
        const removed = db.prepare(`
          UPDATE rpg_inventory SET quantity = quantity - ?
          WHERE telegram_user_id = ? AND item_id = ? AND quantity >= ? AND equipped = 0
        `).run(quantity, uid, itemId, quantity);
        if (removed.changes !== 1) throw new Error('Inventory berubah');
        db.prepare('DELETE FROM rpg_inventory WHERE telegram_user_id = ? AND item_id = ? AND quantity <= 0')
          .run(uid, itemId);
        return db.prepare(`
          INSERT INTO rpg_market_listings
            (seller_id, item_id, quantity, unit_price, upgrade_tier, expires_at, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          uid, itemId, quantity, unitPrice, inventory.upgrade_tier || 0,
          timestamp + LISTING_TTL_SECONDS, timestamp,
        ).lastInsertRowid;
      })();
      return { success: true, listingId, item: inventory.display_name, bounds };
    },
    cancel(userId, listingId) {
      expireListings();
      const listing = db.prepare(`
        SELECT * FROM rpg_market_listings WHERE id = ? AND seller_id = ? AND status = 'active'
      `).get(listingId, String(userId));
      if (!listing) return { success: false, reason: 'Listing aktif tidak ditemukan.' };
      db.transaction(() => returnEscrow(listing, 'cancelled'))();
      return { success: true };
    },
    buy(userId, listingId) {
      const buyerId = String(userId);
      expireListings();
      try {
        return db.transaction(() => {
          const listing = db.prepare(`
            SELECT l.*, c.display_name
            FROM rpg_market_listings l JOIN items_catalog c ON c.item_id = l.item_id
            WHERE l.id = ? AND l.status = 'active' AND l.expires_at > ?
          `).get(listingId, now());
          if (!listing) return { success: false, reason: 'Listing sudah tidak tersedia.' };
          if (listing.seller_id === buyerId) return { success: false, reason: 'Tidak bisa membeli listing sendiri.' };
          const gross = listing.quantity * listing.unit_price;
          const tax = Math.max(1, Math.floor(gross * MARKET_TAX_RATE));
          const proceeds = gross - tax;
          const timestamp = now();
          const charged = db.prepare(`
            UPDATE rpg_users SET gold = gold - ?, updated_at = ?
            WHERE telegram_user_id = ? AND gold >= ?
          `).run(gross, timestamp, buyerId, gross);
          if (charged.changes !== 1) return { success: false, reason: 'Gold tidak cukup.' };
          const claimed = db.prepare(`
            UPDATE rpg_market_listings
            SET status = 'sold', buyer_id = ?, completed_at = ?
            WHERE id = ? AND status = 'active'
          `).run(buyerId, timestamp, listing.id);
          if (claimed.changes !== 1) throw new Error('Listing already claimed');
          db.prepare(`
            UPDATE rpg_users SET gold = MIN(50000, gold + ?), updated_at = ?
            WHERE telegram_user_id = ?
          `).run(proceeds, timestamp, listing.seller_id);
          db.prepare(`
            INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity, upgrade_tier)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(telegram_user_id, item_id)
            DO UPDATE SET quantity = quantity + excluded.quantity
          `).run(buyerId, listing.item_id, listing.quantity, listing.upgrade_tier);
          db.prepare(`
            INSERT INTO rpg_market_sales
              (listing_id, seller_id, buyer_id, item_id, quantity,
               gross_amount, tax_amount, seller_proceeds, sold_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            listing.id, listing.seller_id, buyerId, listing.item_id,
            listing.quantity, gross, tax, proceeds, timestamp,
          );
          const buyerBalance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(buyerId).gold;
          const sellerBalance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(listing.seller_id).gold;
          ledger.record({
            entryKey: `market:${listing.id}:buyer`,
            userId: buyerId, amount: -gross, balanceAfter: buyerBalance,
            reason: 'market_purchase', referenceType: 'market_listing', referenceId: listing.id,
          });
          ledger.record({
            entryKey: `market:${listing.id}:seller`,
            userId: listing.seller_id, amount: proceeds, balanceAfter: sellerBalance,
            reason: 'market_sale', referenceType: 'market_listing', referenceId: listing.id,
          });
          ledger.record({
            entryKey: `market:${listing.id}:tax`,
            userId: null, amount: tax, balanceAfter: null,
            reason: 'market_tax', referenceType: 'market_listing', referenceId: listing.id,
          });
          return {
            success: true, item: listing.display_name, quantity: listing.quantity,
            gross, tax, proceeds,
          };
        })();
      } catch (error) {
        if (error.message === 'Listing already claimed') {
          return { success: false, reason: 'Listing sudah dibeli pemain lain.' };
        }
        throw error;
      }
    },
  };
}

module.exports = {
  MARKET_TAX_RATE,
  LISTING_TTL_SECONDS,
  MAX_ACTIVE_LISTINGS,
  createMarketplaceService,
};
