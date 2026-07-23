function weightedPick(items, random = Math.random) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1];
}

function createWorldService(db, options = {}) {
  const random = options.random || Math.random;
  const now = () => Math.floor(Date.now() / 1000);

  function ensureProgress(userId) {
    db.prepare(`
      INSERT OR IGNORE INTO rpg_world_progress (user_id, updated_at)
      VALUES (?, ?)
    `).run(String(userId), now());
    return db.prepare(`
      SELECT p.*, r.name AS region_name, r.description, r.min_level,
             r.content_json
      FROM rpg_world_progress p
      JOIN rpg_regions r ON r.region_id = p.current_region_id
      WHERE p.user_id = ? AND r.published = 1
    `).get(String(userId));
  }

  return {
    getProgress: ensureProgress,
    listRegions(level) {
      return db.prepare(`
        SELECT region_id, name, description, min_level, travel_cost
        FROM rpg_regions
        WHERE published = 1 AND min_level <= ?
        ORDER BY min_level, region_id
      `).all(level);
    },
    travel(userId, regionId, level) {
      const region = db.prepare(`
        SELECT * FROM rpg_regions
        WHERE region_id = ? AND published = 1
      `).get(regionId);
      if (!region) return { success: false, reason: 'Region tidak ditemukan.' };
      if (level < region.min_level) {
        return { success: false, reason: `Butuh level ${region.min_level}.` };
      }
      db.prepare(`
        INSERT INTO rpg_world_progress (user_id, current_region_id, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          current_region_id = excluded.current_region_id,
          updated_at = excluded.updated_at
      `).run(String(userId), regionId, now());
      return { success: true, region };
    },
    explore(userId) {
      const progress = ensureProgress(userId);
      if (!progress) return { success: false, reason: 'Region aktif tidak tersedia.' };
      const content = JSON.parse(progress.content_json);
      const encounter = weightedPick(content.encounters, random);
      const points = encounter.exploration_points || 1;
      db.prepare(`
        UPDATE rpg_world_progress
        SET exploration_points = exploration_points + ?,
            campaign_step = CASE
              WHEN campaign_chapter = 1
               AND campaign_step < 2
               AND exploration_points + ? >= 3
              THEN 2
              ELSE campaign_step
            END,
            updated_at = ?
        WHERE user_id = ?
      `).run(points, points, now(), String(userId));
      const updated = ensureProgress(userId);
      return { success: true, encounter, region: content, points, progress: updated };
    },
  };
}

module.exports = { weightedPick, createWorldService };
