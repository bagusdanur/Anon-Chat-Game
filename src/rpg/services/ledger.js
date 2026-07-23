const crypto = require('crypto');

function createLedgerService(db) {
  const insert = db.prepare(`
    INSERT INTO rpg_currency_ledger
      (entry_key, user_id, currency, amount, balance_after, reason,
       reference_type, reference_id, metadata_json, created_at)
    VALUES
      (@entryKey, @userId, @currency, @amount, @balanceAfter, @reason,
       @referenceType, @referenceId, @metadataJson, @createdAt)
  `);

  return {
    record(entry) {
      if (!Number.isInteger(entry.amount) || entry.amount === 0) {
        throw new TypeError('Ledger amount must be a non-zero integer');
      }
      const payload = {
        entryKey: entry.entryKey || crypto.randomUUID(),
        userId: entry.userId == null ? null : String(entry.userId),
        currency: entry.currency || 'gold',
        amount: entry.amount,
        balanceAfter: entry.balanceAfter ?? null,
        reason: entry.reason,
        referenceType: entry.referenceType || null,
        referenceId: entry.referenceId == null ? null : String(entry.referenceId),
        metadataJson: entry.metadata ? JSON.stringify(entry.metadata) : null,
        createdAt: entry.createdAt || Math.floor(Date.now() / 1000),
      };
      insert.run(payload);
      return payload.entryKey;
    },
    findByUser(userId, limit = 50) {
      return db.prepare(`
        SELECT * FROM rpg_currency_ledger
        WHERE user_id = ?
        ORDER BY id DESC LIMIT ?
      `).all(String(userId), Math.min(Math.max(limit, 1), 200));
    },
  };
}

module.exports = { createLedgerService };
