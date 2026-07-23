const crypto = require('crypto');
const { createLedgerService } = require('./ledger');

const TRADE_TTL_SECONDS = 10 * 60;
const GOLD_TAX_RATE = 0.05;

function createDirectTradeService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const ledger = createLedgerService(db);

  function expire() {
    return db.prepare(`
      UPDATE rpg_trade_sessions_v2 SET status='expired'
      WHERE status='pending' AND expires_at<=?
    `).run(now()).changes;
  }

  function normalizeOffer(userId, offer) {
    if (offer.type === 'gold') {
      const amount = Number(offer.amount);
      if (!Number.isInteger(amount) || amount <= 0) return { success: false, reason: 'Jumlah gold tidak valid.' };
      const user = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
      if (!user || user.gold < amount) return { success: false, reason: 'Gold tidak cukup.' };
      return { success: true, offer: { type: 'gold', amount } };
    }
    if (offer.type === 'item') {
      const quantity = Number(offer.quantity);
      if (!offer.itemId || !Number.isInteger(quantity) || quantity <= 0) {
        return { success: false, reason: 'Item atau jumlah tidak valid.' };
      }
      const item = db.prepare(`
        SELECT i.*,c.display_name,c.category FROM rpg_inventory i
        JOIN items_catalog c ON c.item_id=i.item_id
        WHERE i.telegram_user_id=? AND i.item_id=?
      `).get(String(userId), String(offer.itemId));
      if (!item || item.quantity < quantity) return { success: false, reason: 'Jumlah item tidak cukup.' };
      if (item.equipped) return { success: false, reason: 'Item sedang dipakai.' };
      if (!['material', 'consumable'].includes(item.category)) {
        return { success: false, reason: 'Hanya material dan consumable yang dapat ditrade.' };
      }
      return {
        success: true,
        offer: { type: 'item', itemId: item.item_id, displayName: item.display_name, quantity },
      };
    }
    return { success: false, reason: 'Tipe trade tidak valid.' };
  }

  function createOffer(proposerId, recipientId, offer) {
    expire();
    if (!recipientId || String(proposerId) === String(recipientId)) {
      return { success: false, reason: 'Partner trade tidak valid.' };
    }
    const recipient = db.prepare('SELECT telegram_user_id FROM rpg_users WHERE telegram_user_id=?')
      .get(String(recipientId));
    if (!recipient) return { success: false, reason: 'Partner belum memiliki karakter.' };
    const normalized = normalizeOffer(proposerId, offer);
    if (!normalized.success) return normalized;
    const snapshot = JSON.stringify(normalized.offer);
    const hash = crypto.createHash('sha256').update(snapshot).digest('hex');
    try {
      const id = Number(db.prepare(`
        INSERT INTO rpg_trade_sessions_v2
          (proposer_id,recipient_id,offer_json,offer_hash,expires_at,created_at)
        VALUES (?,?,?,?,?,?)
      `).run(
        String(proposerId), String(recipientId), snapshot, hash,
        now() + TRADE_TTL_SECONDS, now(),
      ).lastInsertRowid);
      return { success: true, tradeId: id, offer: normalized.offer };
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return { success: false, reason: 'Masih ada penawaran pending untuk partner ini.' };
      }
      throw error;
    }
  }

  function getPending(userId) {
    expire();
    const row = db.prepare(`
      SELECT * FROM rpg_trade_sessions_v2
      WHERE status='pending' AND (proposer_id=? OR recipient_id=?)
      ORDER BY id DESC LIMIT 1
    `).get(String(userId), String(userId));
    return row ? { ...row, offer: JSON.parse(row.offer_json) } : null;
  }

  function cancel(userId, tradeId) {
    const changed = db.prepare(`
      UPDATE rpg_trade_sessions_v2 SET status='cancelled'
      WHERE id=? AND status='pending' AND (proposer_id=? OR recipient_id=?)
    `).run(Number(tradeId), String(userId), String(userId));
    return changed.changes
      ? { success: true }
      : { success: false, reason: 'Trade pending tidak ditemukan.' };
  }

  function accept(userId, tradeId) {
    expire();
    return db.transaction(() => {
      const trade = db.prepare(`
        SELECT * FROM rpg_trade_sessions_v2
        WHERE id=? AND recipient_id=? AND status='pending' AND expires_at>?
      `).get(Number(tradeId), String(userId), now());
      if (!trade) return { success: false, reason: 'Trade tidak ditemukan atau kedaluwarsa.' };
      const offer = JSON.parse(trade.offer_json);
      const hash = crypto.createHash('sha256').update(trade.offer_json).digest('hex');
      if (hash !== trade.offer_hash) throw new Error('Trade snapshot hash mismatch');
      const current = normalizeOffer(trade.proposer_id, offer.type === 'item'
        ? { type: 'item', itemId: offer.itemId, quantity: offer.quantity }
        : offer);
      if (!current.success) return current;

      const settlement = { ...offer };
      if (offer.type === 'gold') {
        const baseTax = Math.floor(offer.amount * GOLD_TAX_RATE);
        const intended = offer.amount - baseTax;
        const recipientBefore = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?')
          .get(trade.recipient_id).gold;
        const received = Math.max(0, Math.min(intended, 50000 - recipientBefore));
        const tax = offer.amount - received;
        db.prepare('UPDATE rpg_users SET gold=gold-?,updated_at=? WHERE telegram_user_id=?')
          .run(offer.amount, now(), trade.proposer_id);
        db.prepare('UPDATE rpg_users SET gold=gold+?,updated_at=? WHERE telegram_user_id=?')
          .run(received, now(), trade.recipient_id);
        const senderBalance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(trade.proposer_id).gold;
        const recipientBalance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id=?').get(trade.recipient_id).gold;
        ledger.record({
          entryKey: `direct_trade:${trade.id}:sender`, userId: trade.proposer_id,
          amount: -received, balanceAfter: senderBalance + tax, reason: 'direct_trade_send',
          referenceType: 'direct_trade', referenceId: trade.id,
        });
        ledger.record({
          entryKey: `direct_trade:${trade.id}:recipient`, userId: trade.recipient_id,
          amount: received, balanceAfter: recipientBalance, reason: 'direct_trade_receive',
          referenceType: 'direct_trade', referenceId: trade.id,
        });
        if (tax) ledger.record({
          entryKey: `direct_trade:${trade.id}:tax`, userId: trade.proposer_id,
          amount: -tax, balanceAfter: senderBalance, reason: 'direct_trade_tax',
          referenceType: 'direct_trade', referenceId: trade.id,
        });
        settlement.tax = tax;
        settlement.received = received;
      } else {
        const inventory = db.prepare(`
          SELECT * FROM rpg_inventory WHERE telegram_user_id=? AND item_id=?
        `).get(trade.proposer_id, offer.itemId);
        if (inventory.quantity === offer.quantity) {
          db.prepare('DELETE FROM rpg_inventory WHERE id=?').run(inventory.id);
        } else {
          db.prepare('UPDATE rpg_inventory SET quantity=quantity-? WHERE id=?')
            .run(offer.quantity, inventory.id);
        }
        db.prepare(`
          INSERT INTO rpg_inventory (telegram_user_id,item_id,quantity)
          VALUES (?,?,?) ON CONFLICT(telegram_user_id,item_id)
          DO UPDATE SET quantity=quantity+excluded.quantity
        `).run(trade.recipient_id, offer.itemId, offer.quantity);
      }
      db.prepare(`
        INSERT INTO rpg_trade_receipts_v2 (trade_id,settlement_json,settled_at)
        VALUES (?,?,?)
      `).run(trade.id, JSON.stringify(settlement), now());
      db.prepare(`
        UPDATE rpg_trade_sessions_v2 SET status='completed',completed_at=?
        WHERE id=? AND status='pending'
      `).run(now(), trade.id);
      return { success: true, tradeId: trade.id, settlement };
    })();
  }

  return { expire, createOffer, getPending, cancel, accept };
}

module.exports = { TRADE_TTL_SECONDS, GOLD_TAX_RATE, createDirectTradeService };
