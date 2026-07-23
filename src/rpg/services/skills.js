const fs = require('fs');
const path = require('path');
const { createLedgerService } = require('./ledger');

const SKILLS_FILE = path.join(__dirname, '../../../data/rpg_skills.json');
const LOADOUT_SIZE = 3;
const RESPEC_COOLDOWN_SECONDS = 24 * 60 * 60;

function validateSkill(skill) {
  if (!skill || typeof skill.id !== 'string' || !/^[a-z0-9_]+$/.test(skill.id)) {
    throw new TypeError('Invalid skill id');
  }
  if (typeof skill.class_id !== 'string' || typeof skill.name !== 'string') {
    throw new TypeError(`Skill ${skill.id}: class_id and name are required`);
  }
  if (!Number.isInteger(skill.max_rank) || skill.max_rank < 1) {
    throw new TypeError(`Skill ${skill.id}: max_rank must be a positive integer`);
  }
  if (!Number.isInteger(skill.min_level) || skill.min_level < 1) {
    throw new TypeError(`Skill ${skill.id}: min_level must be a positive integer`);
  }
  if (!skill.effect || typeof skill.effect.type !== 'string') {
    throw new TypeError(`Skill ${skill.id}: effect.type is required`);
  }
  return skill;
}

function loadSkills(filePath = SKILLS_FILE) {
  const skills = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(skills)) throw new TypeError('Skill content must be an array');
  const ids = new Set();
  for (const skill of skills) {
    validateSkill(skill);
    if (ids.has(skill.id)) throw new TypeError(`Duplicate skill: ${skill.id}`);
    ids.add(skill.id);
  }
  for (const skill of skills) {
    if (skill.requires && !ids.has(skill.requires)) {
      throw new TypeError(`Skill ${skill.id}: unknown prerequisite ${skill.requires}`);
    }
  }
  return skills;
}

function publishSkills(db, skills) {
  const statement = db.prepare(`
    INSERT INTO rpg_skill_definitions
      (skill_id, class_id, name, role, max_rank, definition_json, published)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT(skill_id) DO UPDATE SET
      class_id = excluded.class_id,
      name = excluded.name,
      role = excluded.role,
      max_rank = excluded.max_rank,
      definition_json = excluded.definition_json,
      published = 1
  `);
  db.transaction(() => {
    for (const skill of skills) {
      statement.run(
        skill.id, skill.class_id, skill.name, skill.role,
        skill.max_rank, JSON.stringify(skill),
      );
    }
  })();
}

function totalSkillPoints(level) {
  return 1 + Math.floor(Math.max(0, level - 1) / 2);
}

function createSkillService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const ledger = createLedgerService(db);

  function getUser(userId) {
    return db.prepare(
      'SELECT telegram_user_id, class_name, level, gold FROM rpg_users WHERE telegram_user_id = ?',
    ).get(String(userId));
  }

  function getLearned(userId) {
    return db.prepare(`
      SELECT us.*, sd.name, sd.role, sd.max_rank, sd.definition_json
      FROM rpg_user_skills us
      JOIN rpg_skill_definitions sd ON sd.skill_id = us.skill_id
      WHERE us.user_id = ?
      ORDER BY us.equipped_slot IS NULL, us.equipped_slot, us.skill_id
    `).all(String(userId));
  }

  function availablePoints(userId) {
    const user = getUser(userId);
    if (!user) return 0;
    const spent = db.prepare(
      'SELECT COALESCE(SUM(rank), 0) AS points FROM rpg_user_skills WHERE user_id = ?',
    ).get(String(userId)).points;
    return Math.max(0, totalSkillPoints(user.level) - spent);
  }

  return {
    getTree(userId) {
      const user = getUser(userId);
      if (!user) return null;
      const learned = new Map(getLearned(userId).map(skill => [skill.skill_id, skill]));
      const definitions = db.prepare(`
        SELECT * FROM rpg_skill_definitions
        WHERE class_id = ? AND published = 1 ORDER BY skill_id
      `).all(user.class_name).map(row => ({
        ...JSON.parse(row.definition_json),
        rank: learned.get(row.skill_id)?.rank || 0,
        equipped_slot: learned.get(row.skill_id)?.equipped_slot ?? null,
      }));
      return { user, skills: definitions, availablePoints: availablePoints(userId) };
    },
    learn(userId, skillId) {
      const user = getUser(userId);
      if (!user) return { success: false, reason: 'Karakter tidak ditemukan.' };
      const row = db.prepare(
        'SELECT * FROM rpg_skill_definitions WHERE skill_id = ? AND published = 1',
      ).get(skillId);
      if (!row) return { success: false, reason: 'Skill tidak ditemukan.' };
      const definition = JSON.parse(row.definition_json);
      if (definition.class_id !== user.class_name) {
        return { success: false, reason: 'Skill ini bukan untuk class-mu.' };
      }
      if (user.level < definition.min_level) {
        return { success: false, reason: `Butuh level ${definition.min_level}.` };
      }
      const current = db.prepare(
        'SELECT rank FROM rpg_user_skills WHERE user_id = ? AND skill_id = ?',
      ).get(String(userId), skillId);
      if (current && current.rank >= definition.max_rank) {
        return { success: false, reason: 'Skill sudah mencapai rank maksimal.' };
      }
      if (definition.requires) {
        const prerequisite = db.prepare(
          'SELECT rank FROM rpg_user_skills WHERE user_id = ? AND skill_id = ?',
        ).get(String(userId), definition.requires);
        if (!prerequisite) return { success: false, reason: 'Skill prasyarat belum dipelajari.' };
      }
      if (availablePoints(userId) < 1) {
        return { success: false, reason: 'Skill point tidak cukup.' };
      }
      db.prepare(`
        INSERT INTO rpg_user_skills (user_id, skill_id, rank, unlocked_at)
        VALUES (?, ?, 1, ?)
        ON CONFLICT(user_id, skill_id) DO UPDATE SET rank = rank + 1
      `).run(String(userId), skillId, now());
      return { success: true, skill: definition, rank: (current?.rank || 0) + 1 };
    },
    equip(userId, skillId, slot) {
      if (!Number.isInteger(slot) || slot < 1 || slot > LOADOUT_SIZE) {
        return { success: false, reason: `Slot harus 1-${LOADOUT_SIZE}.` };
      }
      const learned = db.prepare(`
        SELECT us.skill_id, sd.name FROM rpg_user_skills us
        JOIN rpg_skill_definitions sd ON sd.skill_id = us.skill_id
        WHERE us.user_id = ? AND us.skill_id = ?
      `).get(String(userId), skillId);
      if (!learned) return { success: false, reason: 'Pelajari skill itu terlebih dahulu.' };
      db.transaction(() => {
        db.prepare(
          'UPDATE rpg_user_skills SET equipped_slot = NULL WHERE user_id = ? AND equipped_slot = ?',
        ).run(String(userId), slot);
        db.prepare(
          'UPDATE rpg_user_skills SET equipped_slot = ? WHERE user_id = ? AND skill_id = ?',
        ).run(slot, String(userId), skillId);
      })();
      return { success: true, skill: learned.name, slot };
    },
    respecQuote(userId) {
      const user = getUser(userId);
      if (!user) return { allowed: false, reason: 'Karakter tidak ditemukan.' };
      const last = db.prepare(
        'SELECT created_at FROM rpg_respec_history WHERE user_id = ? ORDER BY id DESC LIMIT 1',
      ).get(String(userId));
      const remaining = last
        ? Math.max(0, RESPEC_COOLDOWN_SECONDS - (now() - last.created_at))
        : 0;
      const points = totalSkillPoints(user.level) - availablePoints(userId);
      const cost = 250 + (user.level * 25);
      return { allowed: remaining === 0 && points > 0, remaining, points, cost, gold: user.gold };
    },
    respec(userId) {
      const quote = this.respecQuote(userId);
      if (!quote.allowed) {
        return { success: false, reason: quote.remaining > 0 ? 'Respec masih cooldown.' : 'Belum ada skill untuk di-reset.' };
      }
      if (quote.gold < quote.cost) return { success: false, reason: 'Gold tidak cukup.' };
      const timestamp = now();
      db.transaction(() => {
        const updated = db.prepare(
          'UPDATE rpg_users SET gold = gold - ?, updated_at = ? WHERE telegram_user_id = ? AND gold >= ?',
        ).run(quote.cost, timestamp, String(userId), quote.cost);
        if (updated.changes !== 1) throw new Error('Insufficient gold');
        db.prepare('DELETE FROM rpg_user_skills WHERE user_id = ?').run(String(userId));
        db.prepare(`
          INSERT INTO rpg_respec_history (user_id, gold_cost, refunded_points, created_at)
          VALUES (?, ?, ?, ?)
        `).run(String(userId), quote.cost, quote.points, timestamp);
        ledger.record({
          entryKey: `skill_respec:${userId}:${timestamp}`,
          userId,
          amount: -quote.cost,
          balanceAfter: quote.gold - quote.cost,
          reason: 'skill_respec',
          referenceType: 'respec',
          referenceId: timestamp,
        });
      })();
      return { success: true, refundedPoints: quote.points, cost: quote.cost };
    },
    getLearned,
    availablePoints,
  };
}

module.exports = {
  SKILLS_FILE,
  LOADOUT_SIZE,
  RESPEC_COOLDOWN_SECONDS,
  validateSkill,
  loadSkills,
  publishSkills,
  totalSkillPoints,
  createSkillService,
};
