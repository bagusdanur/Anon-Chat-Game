const fs = require('fs');
const path = require('path');

const CAMPAIGN_FILE = path.join(__dirname, '../../../data/rpg_campaign.json');

function validateCampaign(definitions) {
  if (!Array.isArray(definitions)) throw new TypeError('Campaign content must be an array');
  const ids = new Set();
  for (const quest of definitions) {
    if (!quest.id || ids.has(quest.id)) throw new TypeError('Campaign quest id must be unique');
    ids.add(quest.id);
    if (!Array.isArray(quest.objectives) || quest.objectives.length === 0) {
      throw new TypeError(`Campaign ${quest.id}: objectives required`);
    }
  }
  for (const quest of definitions) {
    if (quest.requires && !ids.has(quest.requires)) {
      throw new TypeError(`Campaign ${quest.id}: unknown prerequisite`);
    }
  }
  return definitions;
}

function loadCampaign(filePath = CAMPAIGN_FILE) {
  return validateCampaign(JSON.parse(fs.readFileSync(filePath, 'utf8')));
}

function publishCampaign(db, definitions) {
  const statement = db.prepare(`
    INSERT INTO rpg_campaign_definitions
      (quest_id, chapter, sort_order, title, definition_json, published, content_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(quest_id) DO UPDATE SET
      chapter = excluded.chapter, sort_order = excluded.sort_order,
      title = excluded.title, definition_json = excluded.definition_json,
      published = excluded.published, content_version = excluded.content_version,
      updated_at = excluded.updated_at
    WHERE excluded.content_version > rpg_campaign_definitions.content_version
  `);
  const now = Math.floor(Date.now() / 1000);
  db.transaction(() => definitions.forEach(quest => statement.run(
    quest.id, quest.chapter, quest.order, quest.title, JSON.stringify(quest),
    quest.published ? 1 : 0, quest.version || 1, now,
  )))();
}

function createCampaignService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));

  function ensureAvailable(userId) {
    const quests = db.prepare(`
      SELECT * FROM rpg_campaign_definitions WHERE published = 1 ORDER BY chapter, sort_order
    `).all();
    for (const row of quests) {
      const definition = JSON.parse(row.definition_json);
      if (definition.requires) {
        const prerequisite = db.prepare(`
          SELECT status FROM rpg_campaign_progress_v2 WHERE user_id = ? AND quest_id = ?
        `).get(String(userId), definition.requires);
        if (!prerequisite || !['completed', 'claimed'].includes(prerequisite.status)) continue;
      }
      db.prepare(`
        INSERT OR IGNORE INTO rpg_campaign_progress_v2
          (user_id, quest_id, objective_json, started_at)
        VALUES (?, ?, '{}', ?)
      `).run(String(userId), definition.id, now());
    }
  }

  return {
    list(userId) {
      ensureAvailable(userId);
      return db.prepare(`
        SELECT p.*, d.title, d.chapter, d.sort_order, d.definition_json
        FROM rpg_campaign_progress_v2 p
        JOIN rpg_campaign_definitions d ON d.quest_id = p.quest_id
        WHERE p.user_id = ?
        ORDER BY d.chapter, d.sort_order
      `).all(String(userId)).map(row => ({
        ...row,
        progress: JSON.parse(row.objective_json),
        definition: JSON.parse(row.definition_json),
      }));
    },
    recordEvent(userId, event) {
      const timestamp = now();
      return db.transaction(() => {
        const receipt = db.prepare(`
          INSERT OR IGNORE INTO rpg_campaign_event_receipts
            (event_key, user_id, event_type, target_id, amount, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(
          event.key, String(userId), event.type, event.target || null,
          event.amount || 1, timestamp,
        );
        if (receipt.changes === 0) return { processed: false, completed: [] };
        ensureAvailable(userId);
        const active = this.list(userId).filter(quest => quest.status === 'active');
        const completed = [];
        for (const quest of active) {
          let changed = false;
          for (const objective of quest.definition.objectives) {
            if (objective.type !== event.type) continue;
            if (objective.target && objective.target !== event.target) continue;
            quest.progress[objective.id] = Math.min(
              objective.count,
              (quest.progress[objective.id] || 0) + (event.amount || 1),
            );
            changed = true;
          }
          if (!changed) continue;
          const done = quest.definition.objectives.every(
            objective => (quest.progress[objective.id] || 0) >= objective.count,
          );
          db.prepare(`
            UPDATE rpg_campaign_progress_v2
            SET objective_json = ?, status = ?, completed_at = ?
            WHERE user_id = ? AND quest_id = ? AND status = 'active'
          `).run(
            JSON.stringify(quest.progress), done ? 'completed' : 'active',
            done ? timestamp : null, String(userId), quest.quest_id,
          );
          if (done) completed.push(quest.quest_id);
        }
        ensureAvailable(userId);
        return { processed: true, completed };
      })();
    },
  };
}

module.exports = {
  CAMPAIGN_FILE,
  validateCampaign,
  loadCampaign,
  publishCampaign,
  createCampaignService,
};
