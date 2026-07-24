const { createSocialService } = require('./social');

function clearPersistentPartnerState(db, chatId, partnerId, now = () => Math.floor(Date.now() / 1000)) {
  if (!partnerId) return { partyEnded: false, dungeonEnded: false };
  const partyResult = createSocialService(db, { now }).disconnectPair(chatId, partnerId);
  const timestamp = now();
  const dungeonEnded = db.transaction(() => {
    db.prepare(`
      UPDATE rpg_dungeon_invites_v2
      SET status='cancelled',responded_at=?
      WHERE status='pending' AND (
        (inviter_id=? AND recipient_id=?) OR
        (inviter_id=? AND recipient_id=?)
      )
    `).run(
      timestamp,
      String(chatId), String(partnerId),
      String(partnerId), String(chatId),
    );
    return db.prepare(`
      UPDATE rpg_dungeon_sessions_v2
      SET status='abandoned',updated_at=?,completed_at=?
      WHERE status='active' AND mode='duo' AND (
        (owner_id=? AND partner_id=?) OR
        (owner_id=? AND partner_id=?)
      )
    `).run(
      timestamp, timestamp,
      String(chatId), String(partnerId),
      String(partnerId), String(chatId),
    ).changes > 0;
  })();
  return { partyEnded: partyResult.partyEnded, dungeonEnded };
}

module.exports = { clearPersistentPartnerState };
