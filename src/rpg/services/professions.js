const PROFESSION_DEFS = {
  hunting: { name: '🏹 Hunting', source: 'hunt' },
  fishing: { name: '🎣 Fishing', source: 'fish' },
  mining: { name: '⛏️ Mining', source: 'mine' },
  herbalism: { name: '🌿 Herbalism', source: 'gather' },
  smithing: { name: '🔨 Smithing', source: 'craft' },
  alchemy: { name: '⚗️ Alchemy', source: 'alchemy' },
  enchanting: { name: '✨ Enchanting', source: 'upgrade' },
};

function professionXpToNext(level) {
  return Math.floor(35 * Math.pow(level, 1.25));
}

function createProfessionService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));

  return {
    list(userId) {
      const rows = new Map(db.prepare(
        'SELECT * FROM rpg_professions WHERE user_id = ?',
      ).all(String(userId)).map(row => [row.profession_id, row]));
      return Object.entries(PROFESSION_DEFS).map(([id, definition]) => ({
        id,
        ...definition,
        level: rows.get(id)?.level || 1,
        xp: rows.get(id)?.xp || 0,
        mastery: rows.get(id)?.mastery || 0,
      }));
    },
    grantXp(userId, professionId, amount, eventKey) {
      if (!PROFESSION_DEFS[professionId]) throw new Error(`Unknown profession: ${professionId}`);
      if (!Number.isInteger(amount) || amount <= 0) throw new TypeError('Profession XP must be positive');
      return db.transaction(() => {
        if (eventKey) {
          const receipt = db.prepare(`
            INSERT OR IGNORE INTO rpg_profession_events
              (event_key, user_id, profession_id, xp_amount, created_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(eventKey, String(userId), professionId, amount, now());
          if (receipt.changes === 0) return { processed: false };
        }
        db.prepare(`
          INSERT OR IGNORE INTO rpg_professions
            (user_id, profession_id, level, xp, mastery, updated_at)
          VALUES (?, ?, 1, 0, 0, ?)
        `).run(String(userId), professionId, now());
        const row = db.prepare(`
          SELECT * FROM rpg_professions WHERE user_id = ? AND profession_id = ?
        `).get(String(userId), professionId);
        let level = row.level;
        let xp = row.xp + amount;
        let levelsGained = 0;
        while (xp >= professionXpToNext(level)) {
          xp -= professionXpToNext(level);
          level++;
          levelsGained++;
        }
        const mastery = Math.floor(level / 10);
        db.prepare(`
          UPDATE rpg_professions
          SET level = ?, xp = ?, mastery = ?, updated_at = ?
          WHERE user_id = ? AND profession_id = ?
        `).run(level, xp, mastery, now(), String(userId), professionId);
        return { processed: true, level, xp, levelsGained, mastery };
      })();
    },
  };
}

module.exports = { PROFESSION_DEFS, professionXpToNext, createProfessionService };
