const fs = require('fs');
const path = require('path');
const { createLedgerService } = require('./ledger');
const { createEquipmentService } = require('./equipment');
const { MAX_ENERGY } = require('../db_rpg');
const {
  enemyMaxHp: calculateEnemyMaxHp,
  combinedPower,
  outgoingDamage,
  incomingDamage,
} = require('./dungeonCombatBalance');
require('../../../data/patch_loader');

const DUNGEONS_FILE = path.join(__dirname, '../../../data/rpg_dungeons.json');
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const INVITE_TTL_SECONDS = 10 * 60;
const LEVEL_CAP = 60;

function validateDungeon(definition) {
  if (!definition || typeof definition.id !== 'string' || !definition.id) {
    throw new TypeError('Dungeon id is required');
  }
  if (!Array.isArray(definition.rooms) || definition.rooms.length < 2) {
    throw new TypeError(`Dungeon ${definition.id}: rooms are required`);
  }
  const rooms = new Map();
  for (const room of definition.rooms) {
    if (!room.id || rooms.has(room.id)) throw new TypeError(`Dungeon ${definition.id}: duplicate/invalid room`);
    rooms.set(room.id, room);
  }
  if (!rooms.has(definition.entry_room)) throw new TypeError(`Dungeon ${definition.id}: entry room missing`);
  for (const room of rooms.values()) {
    const targets = [
      room.next, room.success, room.failure,
      ...(room.options || []).map(option => option.next),
    ].filter(Boolean);
    for (const target of targets) {
      if (!rooms.has(target)) throw new TypeError(`Dungeon ${definition.id}: unknown room ${target}`);
    }
  }
  return definition;
}

function loadDungeons(filePath = DUNGEONS_FILE) {
  const definitions = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(definitions)) throw new TypeError('Dungeon content must be an array');
  return definitions.map(validateDungeon);
}

function publishDungeons(db, definitions) {
  const upsert = db.prepare(`
    INSERT INTO rpg_dungeon_definitions
      (dungeon_id, name, min_level, definition_json, published, content_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(dungeon_id) DO UPDATE SET
      name = excluded.name,
      min_level = excluded.min_level,
      definition_json = excluded.definition_json,
      published = excluded.published,
      content_version = excluded.content_version,
      updated_at = excluded.updated_at
    WHERE excluded.content_version > rpg_dungeon_definitions.content_version
  `);
  const now = Math.floor(Date.now() / 1000);
  db.transaction(() => {
    for (const definition of definitions) {
      const rewardItems = [
        definition.rewards?.item,
        ...definition.rooms.map(room => room.reward?.item),
      ].filter(Boolean);
      for (const itemId of rewardItems) {
        if (!db.prepare('SELECT 1 ok FROM items_catalog WHERE item_id=?').get(itemId)) {
          throw new TypeError(`Dungeon ${definition.id}: unknown reward item ${itemId}`);
        }
      }
      upsert.run(
        definition.id, definition.name, definition.min_level,
        JSON.stringify(definition), definition.published ? 1 : 0,
        definition.version || 1, now,
      );
    }
  })();
}

function createLongDungeonService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const random = options.random || Math.random;
  const xpToNextLevel = options.xpToNextLevel || (level => Math.floor(40 * Math.pow(level, 1.2)));
  const calcStats = options.calcStats || (() => null);
  const ledger = createLedgerService(db);
  const equipment = createEquipmentService(db, { now, random });
  const onEvent = options.onEvent || (() => {});

  function hydrate(row) {
    if (!row) return null;
    return { ...row, state: JSON.parse(row.state_json), definition: JSON.parse(row.definition_json) };
  }

  function getRoom(session) {
    return session.definition.rooms.find(room => room.id === session.current_room_id);
  }

  function getActive(userId) {
    const row = db.prepare(`
      SELECT s.*, d.definition_json
      FROM rpg_dungeon_sessions_v2 s
      JOIN rpg_dungeon_definitions d ON d.dungeon_id = s.dungeon_id
      WHERE (s.owner_id = ? OR s.partner_id = ?) AND s.status = 'active'
      ORDER BY s.id DESC LIMIT 1
    `).get(String(userId), String(userId));
    if (!row) return null;
    if (row.expires_at <= now()) {
      db.prepare(
        "UPDATE rpg_dungeon_sessions_v2 SET status = 'abandoned', updated_at = ? WHERE id = ? AND status = 'active'",
      ).run(now(), row.id);
      return null;
    }
    return hydrate(row);
  }

  function calculatePower(user) {
    if (user._calculatedPower) return user._calculatedPower;
    const bonus = equipment.bonuses(user.telegram_user_id);
    return user.atk + (bonus.atk || 0) +
      user.def + (bonus.def || 0) +
      (user.magic_atk || 0) + (bonus.magic_atk || 0) +
      Math.floor(user.level * 1.5);
  }

  function effectiveHealth(user) {
    const bonusMaxHp = Math.max(0, Number(equipment.bonuses(user.telegram_user_id).max_hp) || 0);
    return {
      hp: Math.max(1, Number(user.hp) + bonusMaxHp),
      maxHp: Math.max(1, Number(user.max_hp) + bonusMaxHp),
    };
  }

  function effectiveDefense(user) {
    const bonusDef = Math.max(0, Number(equipment.bonuses(user.telegram_user_id).def) || 0);
    return Math.max(0, Number(user.def) || 0) + bonusDef;
  }

  function getAlias(userId) {
    return db.prepare('SELECT alias FROM rpg_character_aliases WHERE user_id = ?')
      .get(String(userId))?.alias || 'Petualang Anonim';
  }

  function enemyMaxHp(session, room) {
    return calculateEnemyMaxHp(
      room,
      session.mode,
      session.definition.recommended_level || session.definition.min_level,
    );
  }

  function awardCompletion(session) {
    const baseReward = session.definition.rewards || {};
    const treasureRewards = Object.values(session.state.collected || {});
    const reward = {
      ...baseReward,
      gold: (baseReward.gold || 0) + treasureRewards.reduce((sum, item) => sum + (item.gold || 0), 0),
      items: [
        ...(baseReward.item ? [{ item: baseReward.item, quantity: baseReward.quantity || 1 }] : []),
        ...treasureRewards.filter(item => item.item)
          .map(item => ({ item: item.item, quantity: item.quantity || 1 })),
      ],
    };
    const rewardKey = `completion:v${session.definition.version || 1}`;
    const timestamp = now();
    const recipients = [session.owner_id, session.partner_id].filter(Boolean);
    let claimed = false;
    for (const recipientId of recipients) {
      const claim = db.prepare(`
        INSERT OR IGNORE INTO rpg_dungeon_reward_claims
          (session_id, user_id, reward_key, reward_json, claimed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(session.id, recipientId, rewardKey, JSON.stringify(reward), timestamp);
      if (claim.changes === 0) continue;
      claimed = true;
      const periodKey = new Date(timestamp * 1000).toISOString().slice(0, 10);
      const energyBonuses = [
        { type: 'daily_dungeon_clear', amount: 3 },
        ...(session.mode === 'duo' ? [{ type: 'daily_duo_activity', amount: 2 }] : []),
      ];
      for (const bonus of energyBonuses) {
        const receipt = db.prepare(`
          INSERT OR IGNORE INTO rpg_energy_bonus_receipts
            (user_id,period_key,bonus_type,amount,reference_id,created_at)
          VALUES (?,?,?,?,?,?)
        `).run(recipientId, periodKey, bonus.type, bonus.amount, String(session.id), timestamp);
        if (receipt.changes > 0) {
          db.prepare(`
            UPDATE rpg_users SET energy_current=MIN(?,energy_current+?),updated_at=?
            WHERE telegram_user_id=?
          `).run(MAX_ENERGY, bonus.amount, timestamp, recipientId);
        }
      }
      if (reward.gold) {
      db.prepare('UPDATE rpg_users SET gold = gold + ?, updated_at = ? WHERE telegram_user_id = ?')
          .run(reward.gold, timestamp, recipientId);
        const balance = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(recipientId).gold;
      ledger.record({
          entryKey: `long_dungeon:${session.id}:${recipientId}:gold`,
          userId: recipientId,
        amount: reward.gold,
        balanceAfter: balance,
        reason: 'long_dungeon_reward',
        referenceType: 'dungeon_session',
        referenceId: session.id,
      });
      }
      for (const item of reward.items) {
      db.prepare(`
        INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity)
        VALUES (?, ?, ?)
        ON CONFLICT(telegram_user_id, item_id)
        DO UPDATE SET quantity = quantity + excluded.quantity
        `).run(recipientId, item.item, item.quantity);
      }
      const signatureMaterials = {
        goblin_ruins: 'herba_kabut',
        spider_nest: 'sutra_racun',
        volcano_fortress: 'obsidian_murni',
        astral_citadel: 'kristal_nexus',
        antimatter_spire: 'inti_antimateri',
        emperor_throne_citadel: 'inti_supernova',
      };
      const signatureMaterial = signatureMaterials[session.dungeon_id];
      const clearCount = Number(db.prepare(`
        SELECT COUNT(1) total
        FROM rpg_dungeon_reward_claims c
        JOIN rpg_dungeon_sessions_v2 s ON s.id=c.session_id
        WHERE c.user_id=? AND s.dungeon_id=?
      `).get(recipientId, session.dungeon_id)?.total || 0);
      const firstClear = clearCount === 1;
      if (signatureMaterial && (firstClear || random() < 0.35)) {
        db.prepare(`
          INSERT INTO rpg_inventory (telegram_user_id,item_id,quantity)
          VALUES (?,?,1)
          ON CONFLICT(telegram_user_id,item_id) DO UPDATE SET quantity=quantity+1
        `).run(recipientId, signatureMaterial);
      }
      if (random() < 0.08) {
        db.prepare(`
          INSERT INTO rpg_inventory (telegram_user_id,item_id,quantity)
          VALUES (?,'reforge_catalyst',1)
          ON CONFLICT(telegram_user_id,item_id) DO UPDATE SET quantity=quantity+1
        `).run(recipientId);
      }
      const gearPools = {
        goblin_ruins: ['pedang_karatan', 'tongkat_ranting'],
        spider_nest: ['jubah_terkutuk', 'cincin_perak'],
        volcano_fortress: ['pedang_besi', 'tongkat_api', 'amulet_pertahanan'],
        astral_citadel: ['cincin_keberuntungan', 'kalung_kekuatan'],
        antimatter_spire: ['pedang_naga', 'tongkat_es', 'armor_naga'],
        emperor_throne_citadel: ['pedang_naga', 'armor_naga', 'kalung_naga'],
      };
      const pool = gearPools[session.dungeon_id] || [];
      const pity = db.prepare(`
        SELECT misses FROM rpg_dungeon_drop_pity WHERE user_id=? AND dungeon_id=?
      `).get(recipientId, session.dungeon_id);
      const misses = Number(pity?.misses || 0);
      // Duo wajib terasa lebih menguntungkan daripada solo. Pity tetap berlaku
      // per pemain, jadi bonus ini tidak menghilangkan batas keamanan ekonomi.
      const dropChance = session.mode === 'duo' ? 0.18 : 0.12;
      const gearDropped = pool.length && (misses >= 4 || random() < dropChance);
      if (gearDropped) {
        const itemId = pool[Math.floor(random() * pool.length)];
        db.prepare(`
          INSERT INTO rpg_inventory (telegram_user_id,item_id,quantity)
          VALUES (?,?,1)
          ON CONFLICT(telegram_user_id,item_id) DO UPDATE SET quantity=quantity+1
        `).run(recipientId, itemId);
        equipment.forge(recipientId, itemId, {
          itemLevel: Math.max(1, Number(session.definition.recommended_level || session.definition.min_level || 1)),
          qualityMin: 60,
          qualityMax: 90,
          sourceDungeonId: session.dungeon_id,
        });
        db.prepare(`
          INSERT INTO rpg_dungeon_drop_pity (user_id,dungeon_id,misses,last_drop_at)
          VALUES (?,?,0,?)
          ON CONFLICT(user_id,dungeon_id) DO UPDATE SET misses=0,last_drop_at=excluded.last_drop_at
        `).run(recipientId, session.dungeon_id, timestamp);
      } else if (pool.length) {
        db.prepare(`
          INSERT INTO rpg_dungeon_drop_pity (user_id,dungeon_id,misses)
          VALUES (?,?,1)
          ON CONFLICT(user_id,dungeon_id) DO UPDATE SET misses=misses+1
        `).run(recipientId, session.dungeon_id);
      }
      if (reward.xp) {
        const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(recipientId);
      let level = user.level;
      let xp = user.xp + reward.xp;
      while (level < LEVEL_CAP && xp >= xpToNextLevel(level)) {
        xp -= xpToNextLevel(level);
        level++;
      }
      if (level >= LEVEL_CAP) xp = 0;
      const stats = calcStats(user.class_name, level);
      if (stats) {
        db.prepare(`
          UPDATE rpg_users
          SET level = ?, xp = ?, hp = MIN(hp, ?), max_hp = ?, atk = ?, def = ?, magic_atk = ?,
              crit_rate = ?, crit_multi = ?, updated_at = ?
          WHERE telegram_user_id = ?
        `).run(
            level, xp, stats.max_hp, stats.max_hp, stats.atk, stats.def, stats.magic_atk,
            stats.crit_rate, stats.crit_multi, timestamp, recipientId,
        );
      } else {
        db.prepare('UPDATE rpg_users SET level = ?, xp = ?, updated_at = ? WHERE telegram_user_id = ?')
            .run(level, xp, timestamp, recipientId);
        }
      }
    }
    return claimed;
  }

  function autoResolve(session, room, user) {
    const state = session.state;
    const roll = calculatePower(user) * (0.9 + random() * 0.2);
    const success = roll >= room.enemy.power;
    const damage = success ? Math.max(1, Math.floor(room.enemy.damage * 0.45)) : room.enemy.damage;
    state.hp = Math.max(0, state.hp - damage);
    state.log = `${room.enemy.name}: ${success ? 'menang' : 'kalah'} · HP -${damage}`;
    return success && state.hp > 0 ? room.success : room.failure;
  }

  function resolveTacticalTurn(session, room, actor, ally, action, options = {}) {
    const state = session.state;
    const actorPower = calculatePower(actor);
    const allyPower = ally ? calculatePower(ally) : Math.floor(actorPower * 0.15);
    const power = combinedPower(actorPower, allyPower, Boolean(ally));
    const maxEnemyHp = enemyMaxHp(session, room);
    if (!state.combat || state.combat.roomId !== room.id) {
      state.combat = {
        roomId: room.id,
        enemyHp: maxEnemyHp,
        maxEnemyHp,
        turn: 1,
        skillCooldown: 0,
        combo: 0,
        enemyTurns: 0,
        telegraphNext: false,
      };
    }
    const combat = state.combat;
    state.metrics = state.metrics || {
      actions: 0, attacks: 0, defends: 0, skills: 0, combos: 0,
      enemyCycles: 0, combatRoomsCleared: 0,
    };
    const skillId = action.startsWith('skill_') ? action.slice(6) : null;
    const potionId = action.startsWith('potion_') ? action.slice(7) : null;
    const equippedSkill = skillId
      ? db.prepare(`
          SELECT us.rank, sd.definition_json
          FROM rpg_user_skills us
          JOIN rpg_skill_definitions sd ON sd.skill_id=us.skill_id
          WHERE us.user_id=? AND us.skill_id=? AND us.equipped_slot IS NOT NULL
        `).get(String(actor.telegram_user_id), skillId)
      : null;
    if (!['attack', 'defend', 'skill', 'combo'].includes(action) && !skillId && !potionId) {
      return { success: false, reason: 'Pilih Attack, Defend, Skill, Combo, atau Ramuan.' };
    }
    if (skillId && !equippedSkill) {
      return { success: false, reason: 'Skill tidak terpasang pada loadout-mu.' };
    }
    combat.skillCooldowns = combat.skillCooldowns || {};
    const actorCooldowns = combat.skillCooldowns[String(actor.telegram_user_id)] || {};
    if (skillId && (actorCooldowns[skillId] || 0) > 0) {
      return { success: false, reason: `Skill masih cooldown ${actorCooldowns[skillId]} cycle.` };
    }
    if (action === 'combo' && (session.mode !== 'duo' || combat.combo < 3)) {
      return { success: false, reason: 'Combo duo membutuhkan 3 energi kerja sama.' };
    }
    let potion = null;
    let potionHeal = 0;
    if (potionId) {
      potion = db.prepare(`
        SELECT i.item_id,i.quantity,c.display_name,c.effect_json
        FROM rpg_inventory i JOIN items_catalog c ON c.item_id=i.item_id
        WHERE i.telegram_user_id=? AND i.item_id=? AND c.category='consumable'
      `).get(String(actor.telegram_user_id), potionId);
      const effect = potion?.effect_json ? JSON.parse(potion.effect_json) : {};
      const healPct = Number(effect.heal_pct) || 0;
      if (!potion || potion.quantity < 1 || healPct <= 0) {
        return { success: false, reason: 'Ramuan heal itu tidak tersedia di inventory.' };
      }
      if (state.hp >= state.maxHp) return { success: false, reason: 'HP ekspedisi sudah penuh.' };
      potionHeal = Math.max(1, Math.floor(state.maxHp * healPct / 100));
    }
    const metricAction = skillId ? 'skills'
      : action === 'attack' ? 'attacks'
        : action === 'defend' ? 'defends'
          : action === 'combo' ? 'combos' : 'items';
    state.metrics.actions++;
    state.metrics[metricAction]++;

    const skillDefinition = equippedSkill ? JSON.parse(equippedSkill.definition_json) : null;
    const ranked = value => Array.isArray(value)
      ? value[Math.min(equippedSkill.rank - 1, value.length - 1)]
      : value;
    const skillEffect = skillDefinition?.effect || {};
    const isDefensiveSkill = ['guard', 'shield', 'provoke', 'weaken'].includes(skillEffect.type);
    const critRate = Math.min(0.5, Math.max(0, actor.crit_rate || 0));
    const critical = random() < critRate;
    const dealt = potionId ? 0 : outgoingDamage({
      power,
      action: skillId ? 'skill' : action,
      random,
      critical,
      critMultiplier: actor.crit_multi || 1.5,
      skillMultiplier: skillId ? ranked(skillEffect.multiplier) : undefined,
      defensiveSkill: isDefensiveSkill,
    });
    combat.enemyHp = Math.max(0, combat.enemyHp - dealt);
    if (potionId) {
      const consumed = db.prepare(`
        UPDATE rpg_inventory SET quantity=quantity-1
        WHERE telegram_user_id=? AND item_id=? AND quantity>0
      `).run(String(actor.telegram_user_id), potionId);
      if (consumed.changes !== 1) return { success: false, reason: 'Ramuan sudah tidak tersedia.' };
      db.prepare('DELETE FROM rpg_inventory WHERE telegram_user_id=? AND item_id=? AND quantity<=0')
        .run(String(actor.telegram_user_id), potionId);
      state.hp = Math.min(state.maxHp, state.hp + potionHeal);
    }
    if (action === 'skill') combat.skillCooldown = 2;
    if (skillId) {
      combat.skillCooldowns[String(actor.telegram_user_id)] = {
        ...actorCooldowns,
        [skillId]: Number(skillEffect.cooldown) || 0,
      };
    }
    if (session.mode === 'duo') {
      combat.combo = action === 'combo' ? 0 : Math.min(3, combat.combo + 1);
    }
    const defeated = combat.enemyHp <= 0;
    const incoming = incomingDamage({
      enemyDamage: room.enemy.damage,
      mode: session.mode,
      action: potionId ? 'potion' : action,
      defensiveSkill: isDefensiveSkill,
      defeated,
      deferIncoming: options.deferIncoming,
      telegraphed: combat.telegraphNext,
      mitigationOverride: options.mitigationOverride,
      defense: ally
        ? Math.floor((effectiveDefense(actor) + effectiveDefense(ally)) / 2)
        : effectiveDefense(actor),
    });
    if (!defeated && !options.deferIncoming) {
      combat.enemyTurns = (combat.enemyTurns || 0) + 1;
      state.metrics.enemyCycles++;
      combat.telegraphNext = (combat.enemyTurns + 1) % 3 === 0;
    }
    state.hp = Math.max(0, state.hp - incoming);
    if (action !== 'skill' && combat.skillCooldown > 0) combat.skillCooldown--;
    if (session.mode === 'solo') {
      const cooldowns = combat.skillCooldowns[String(actor.telegram_user_id)] || {};
      for (const cooldownSkillId of Object.keys(cooldowns)) {
        if (cooldownSkillId !== skillId) {
          cooldowns[cooldownSkillId] = Math.max(0, cooldowns[cooldownSkillId] - 1);
        }
      }
    }
    const actionLabel = skillDefinition?.name || action;
    state.log = `Turn ${combat.turn}: ${actionLabel}${critical ? ' CRIT' : ''} memberi ${dealt} damage · menerima ${incoming} damage`;
    if (potion) {
      state.log = `Turn ${combat.turn}: minum ${potion.display_name} (+${potionHeal} HP) · menerima ${incoming} damage`;
    }
    combat.turn++;

    if (state.hp <= 0) {
      delete state.combat;
      return { success: true, nextRoomId: room.failure, transitioned: true };
    }
    if (defeated) {
      state.metrics.combatRoomsCleared++;
      delete state.combat;
      return { success: true, nextRoomId: room.success, transitioned: true };
    }
    return { success: true, nextRoomId: room.id, transitioned: false };
  }

  function duoMembers(userId) {
    const party = db.prepare(`
      SELECT p.id FROM rpg_parties p JOIN rpg_party_members m ON m.party_id=p.id
      WHERE m.user_id=? AND p.status='active'
    `).get(String(userId));
    if (!party) return { success: false, reason: 'Buat party berisi dua pemain terlebih dahulu.' };
    const members = db.prepare(`
      SELECT m.user_id,u.* FROM rpg_party_members m JOIN rpg_users u ON u.telegram_user_id=m.user_id
      WHERE m.party_id=? ORDER BY m.joined_at
    `).all(party.id);
    if (members.length !== 2) return { success: false, reason: 'Dungeon duo membutuhkan party tepat dua pemain.' };
    const owner = members.find(member => String(member.user_id) === String(userId));
    const partner = members.find(member => String(member.user_id) !== String(userId));
    return { success: true, owner, partner };
  }

  function createDuoSession(owner, partner, dungeonId) {
    if (getActive(owner.user_id)) return { success: false, reason: 'Kamu masih memiliki ekspedisi aktif.' };
    if (getActive(partner.user_id)) return { success: false, reason: 'Partner masih memiliki ekspedisi aktif.' };
    const definitionRow = db.prepare(`
      SELECT * FROM rpg_dungeon_definitions WHERE dungeon_id=? AND published=1
    `).get(dungeonId);
    if (!definitionRow) return { success: false, reason: 'Dungeon tidak ditemukan.' };
    if (owner.level < definitionRow.min_level || partner.level < definitionRow.min_level) {
      return { success: false, reason: `Semua anggota membutuhkan level ${definitionRow.min_level}.` };
    }
    const timestamp = now();
    const definition = JSON.parse(definitionRow.definition_json);
    const ownerHealth = effectiveHealth(owner);
    const partnerHealth = effectiveHealth(partner);
    const maxHp = ownerHealth.maxHp + partnerHealth.maxHp;
    const state = {
      hp: ownerHealth.hp + partnerHealth.hp, maxHp, companion: 'Partner Party', collected: {},
      visited: [definition.entry_room], log: 'Undangan diterima. Ekspedisi duo dimulai.',
      turnOrder: [String(owner.user_id), String(partner.user_id)],
      turnAliases: [getAlias(owner.user_id), getAlias(partner.user_id)],
      turnIndex: 0,
      actionNumber: 1,
      metrics: {
        actions: 0, attacks: 0, defends: 0, skills: 0, combos: 0,
        enemyCycles: 0, combatRoomsCleared: 0,
      },
    };
    const info = db.prepare(`
      INSERT INTO rpg_dungeon_sessions_v2
        (dungeon_id,owner_id,partner_id,mode,current_room_id,state_json,expires_at,created_at,updated_at)
      VALUES (?,?,?,'duo',?,?,?,?,?)
    `).run(
      dungeonId, String(owner.user_id), String(partner.user_id), definition.entry_room,
      JSON.stringify(state), timestamp + SESSION_TTL_SECONDS, timestamp, timestamp,
    );
    return { success: true, session: hydrate(db.prepare(`
      SELECT s.*, d.definition_json FROM rpg_dungeon_sessions_v2 s
      JOIN rpg_dungeon_definitions d ON d.dungeon_id=s.dungeon_id WHERE s.id=?
    `).get(info.lastInsertRowid)) };
  }

  return {
    list(level) {
      return db.prepare(`
        SELECT dungeon_id, name, min_level, definition_json
        FROM rpg_dungeon_definitions
        WHERE published = 1 AND min_level <= ?
        ORDER BY min_level, dungeon_id
      `).all(level).map(row => {
        const definition = JSON.parse(row.definition_json);
        return {
          dungeon_id: row.dungeon_id,
          name: row.name,
          min_level: row.min_level,
          recommended_level: definition.recommended_level || row.min_level,
        };
      });
    },
    startSolo(userId, dungeonId) {
      if (getActive(userId)) return { success: false, reason: 'Masih ada ekspedisi aktif.' };
      const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(String(userId));
      if (!user) return { success: false, reason: 'Karakter tidak ditemukan.' };
      const definitionRow = db.prepare(`
        SELECT * FROM rpg_dungeon_definitions
        WHERE dungeon_id = ? AND published = 1
      `).get(dungeonId);
      if (!definitionRow) return { success: false, reason: 'Dungeon tidak ditemukan.' };
      if (user.level < definitionRow.min_level) {
        return { success: false, reason: `Butuh level ${definitionRow.min_level}.` };
      }
      const timestamp = now();
      const health = effectiveHealth(user);
      const state = {
        hp: health.hp,
        maxHp: health.maxHp,
        companion: user.class_name === 'ksatria' ? 'Arcanist Mira' : 'Guardian Rowan',
        collected: {},
        visited: [JSON.parse(definitionRow.definition_json).entry_room],
        log: 'Ekspedisi dimulai.',
        metrics: {
          actions: 0, attacks: 0, defends: 0, skills: 0, combos: 0,
          enemyCycles: 0, combatRoomsCleared: 0,
        },
      };
      const info = db.prepare(`
        INSERT INTO rpg_dungeon_sessions_v2
          (dungeon_id, owner_id, mode, current_room_id, state_json,
           expires_at, created_at, updated_at)
        VALUES (?, ?, 'solo', ?, ?, ?, ?, ?)
      `).run(
        dungeonId, String(userId), JSON.parse(definitionRow.definition_json).entry_room,
        JSON.stringify(state), timestamp + SESSION_TTL_SECONDS, timestamp, timestamp,
      );
      return { success: true, session: this.get(info.lastInsertRowid, userId) };
    },
    inviteDuo(userId, dungeonId) {
      if (getActive(userId)) return { success: false, reason: 'Masih ada ekspedisi aktif.' };
      const duo = duoMembers(userId);
      if (!duo.success) return duo;
      const definitionRow = db.prepare(`
        SELECT * FROM rpg_dungeon_definitions WHERE dungeon_id=? AND published=1
      `).get(dungeonId);
      if (!definitionRow) return { success: false, reason: 'Dungeon tidak ditemukan.' };
      if (getActive(duo.partner.user_id)) return { success: false, reason: 'Partner masih memiliki ekspedisi aktif.' };
      if (duo.owner.level < definitionRow.min_level || duo.partner.level < definitionRow.min_level) {
        return { success: false, reason: `Semua anggota membutuhkan level ${definitionRow.min_level}.` };
      }
      const timestamp = now();
      db.prepare(`
        UPDATE rpg_dungeon_invites_v2 SET status='expired',responded_at=?
        WHERE status='pending' AND expires_at<=?
      `).run(timestamp, timestamp);
      const pending = db.prepare(`
        SELECT id FROM rpg_dungeon_invites_v2
        WHERE status='pending' AND expires_at>? AND (
          (inviter_id=? AND recipient_id=?) OR
          (inviter_id=? AND recipient_id=?)
        )
      `).get(
        timestamp,
        String(userId), String(duo.partner.user_id),
        String(duo.partner.user_id), String(userId),
      );
      if (pending) return { success: false, reason: 'Undangan dungeon sebelumnya masih menunggu jawaban partner.' };
      const info = db.prepare(`
        INSERT INTO rpg_dungeon_invites_v2
          (dungeon_id,inviter_id,recipient_id,expires_at,created_at)
        VALUES (?,?,?,?,?)
      `).run(
        dungeonId, String(userId), String(duo.partner.user_id),
        timestamp + INVITE_TTL_SECONDS, timestamp,
      );
      return {
        success: true,
        pending: true,
        invite: {
          id: Number(info.lastInsertRowid),
          dungeonId,
          dungeonName: definitionRow.name,
          inviterId: String(userId),
          inviterAlias: getAlias(userId),
          recipientId: String(duo.partner.user_id),
          expiresAt: timestamp + INVITE_TTL_SECONDS,
        },
      };
    },
    respondDuoInvite(userId, inviteId, accepted) {
      const timestamp = now();
      const invite = db.prepare(`
        SELECT * FROM rpg_dungeon_invites_v2 WHERE id=?
      `).get(Number(inviteId));
      if (!invite || invite.status !== 'pending') return { success: false, reason: 'Undangan sudah tidak aktif.' };
      if (String(invite.recipient_id) !== String(userId)) {
        return { success: false, reason: 'Hanya partner yang diundang dapat merespons.' };
      }
      if (invite.expires_at <= timestamp) {
        db.prepare("UPDATE rpg_dungeon_invites_v2 SET status='expired',responded_at=? WHERE id=?")
          .run(timestamp, invite.id);
        return { success: false, reason: 'Undangan sudah kedaluwarsa.' };
      }
      if (!accepted) {
        db.prepare("UPDATE rpg_dungeon_invites_v2 SET status='declined',responded_at=? WHERE id=? AND status='pending'")
          .run(timestamp, invite.id);
        return { success: true, accepted: false, invite };
      }
      const duo = duoMembers(invite.inviter_id);
      if (!duo.success || String(duo.partner.user_id) !== String(invite.recipient_id)) {
        return { success: false, reason: 'Susunan party sudah berubah.' };
      }
      try {
        const created = db.transaction(() => {
          const updated = db.prepare(`
            UPDATE rpg_dungeon_invites_v2 SET status='accepted',responded_at=?
            WHERE id=? AND status='pending'
          `).run(timestamp, invite.id);
          if (updated.changes !== 1) throw new Error('Undangan sudah diproses.');
          const sessionResult = createDuoSession(duo.owner, duo.partner, invite.dungeon_id);
          if (!sessionResult.success) throw new Error(sessionResult.reason);
          db.prepare('UPDATE rpg_dungeon_invites_v2 SET session_id=? WHERE id=?')
            .run(sessionResult.session.id, invite.id);
          return sessionResult;
        })();
        return { ...created, accepted: true, invite };
      } catch (error) {
        return { success: false, reason: error.message };
      }
    },
    get(sessionId, userId) {
      return hydrate(db.prepare(`
        SELECT s.*, d.definition_json
        FROM rpg_dungeon_sessions_v2 s
        JOIN rpg_dungeon_definitions d ON d.dungeon_id = s.dungeon_id
        WHERE s.id = ? AND (s.owner_id = ? OR s.partner_id = ?)
      `).get(sessionId, String(userId), String(userId)));
    },
    getActive,
    getRoom,
    enemyMaxHp,
    advance(userId, sessionId, expectedVersion, optionId) {
      const session = this.get(sessionId, userId);
      if (!session || session.status !== 'active') return { success: false, reason: 'Ekspedisi tidak aktif.' };
      if (session.expires_at <= now()) return { success: false, reason: 'Checkpoint sudah kedaluwarsa.' };
      if (session.state_version !== expectedVersion) return { success: false, reason: 'Room ini sudah diselesaikan.' };
      const room = getRoom(session);
      const owner = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(session.owner_id);
      const partner = session.partner_id
        ? db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(session.partner_id)
        : null;
      let cycleActions = null;
      if (session.mode === 'duo') {
        session.state.pendingActions = session.state.pendingActions || {};
        if (session.state.pendingActions[String(userId)]) {
          return { success: false, reason: 'Aksimu pada cycle ini sudah terkunci.' };
        }
        const existing = Object.values(session.state.pendingActions)[0];
        if (!['combat', 'boss'].includes(room.type) && existing && existing !== optionId) {
          return {
            success: false,
            reason: 'Pilihan harus disetujui berdua. Pilih opsi yang sama dengan partner.',
          };
        }
        session.state.pendingActions[String(userId)] = optionId;
        if (Object.keys(session.state.pendingActions).length < 2) {
          const timestamp = now();
          const stored = db.prepare(`
            UPDATE rpg_dungeon_sessions_v2
            SET state_json=?, updated_at=?
            WHERE id=? AND status='active' AND state_version=?
          `).run(JSON.stringify(session.state), timestamp, session.id, expectedVersion);
          if (stored.changes !== 1) return { success: false, reason: 'Aksi sudah diproses.' };
          return {
            success: true,
            pending: true,
            session: this.get(session.id, userId),
            room,
          };
        }
        cycleActions = { ...session.state.pendingActions };
        delete session.state.pendingActions;
      }
      let nextRoomId;
      if (room.type === 'event') {
        const option = room.options?.find(item => item.id === optionId);
        if (!option) return { success: false, reason: 'Pilihan tidak valid.' };
        session.state.hp = Math.max(0, session.state.hp - (option.damage || 0));
        nextRoomId = session.state.hp > 0 ? option.next : 'failed';
      } else if (room.type === 'combat' || room.type === 'boss') {
        // `fight` dipertahankan untuk callback lama; UI baru selalu memakai
        // tactical action per turn.
        if (optionId === 'fight') {
          const combined = partner
            ? { _calculatedPower: calculatePower(owner) + calculatePower(partner) }
            : owner;
          nextRoomId = autoResolve(session, room, combined);
        } else if (session.mode === 'duo' && cycleActions) {
          const orderedIds = session.state.turnOrder || [session.owner_id, session.partner_id];
          const defendCount = Object.values(cycleActions)
            .filter(actionId => actionId === 'defend').length;
          const partyMitigation = defendCount >= 2 ? 0.25 : defendCount === 1 ? 0.55 : undefined;
          let tactical = null;
          for (const [actorIndex, actorId] of orderedIds.entries()) {
            const actor = String(actorId) === String(session.owner_id) ? owner : partner;
            const ally = actor === owner ? partner : owner;
            tactical = resolveTacticalTurn(
              session,
              room,
              actor,
              ally,
              cycleActions[String(actorId)],
              {
                deferIncoming: actorIndex < orderedIds.length - 1,
                mitigationOverride: partyMitigation,
              },
            );
            if (!tactical.success) return tactical;
            nextRoomId = tactical.nextRoomId;
            if (nextRoomId !== room.id) break;
          }
          // Cooldown skill loadout berkurang tepat sekali setelah cycle berikutnya selesai.
          const cooldowns = session.state.combat?.skillCooldowns || {};
          for (const [actorId, values] of Object.entries(cooldowns)) {
            const usedSkill = String(cycleActions[actorId] || '').replace(/^skill_/, '');
            for (const skillId of Object.keys(values)) {
              if (skillId !== usedSkill) values[skillId] = Math.max(0, values[skillId] - 1);
            }
          }
        } else {
          const actor = String(userId) === String(session.owner_id) ? owner : partner;
          const ally = actor === owner ? partner : owner;
          const tactical = resolveTacticalTurn(session, room, actor, ally, optionId);
          if (!tactical.success) return tactical;
          nextRoomId = tactical.nextRoomId;
        }
      } else if (room.type === 'treasure') {
        const reward = room.reward || {};
        session.state.collected[room.id] = reward;
        nextRoomId = room.next;
      } else if (room.type === 'rest') {
        const heal = Math.floor(session.state.maxHp * ((room.heal_percent || 0) / 100));
        session.state.hp = Math.min(session.state.maxHp, session.state.hp + heal);
        nextRoomId = room.next;
      } else {
        return { success: false, reason: 'Room terminal tidak dapat dilanjutkan.' };
      }
      if (nextRoomId !== room.id) session.state.visited.push(nextRoomId);
      const nextRoom = session.definition.rooms.find(item => item.id === nextRoomId);
      const terminalStatus = nextRoom.type === 'finish'
        ? 'completed'
        : nextRoom.type === 'failure' ? 'failed' : 'active';
      if (session.mode === 'duo') {
        session.state.actionNumber = (session.state.actionNumber || 1) + 1;
      }
      const timestamp = now();
      const update = db.prepare(`
        UPDATE rpg_dungeon_sessions_v2
        SET current_room_id = ?, state_json = ?, state_version = state_version + 1,
            status = ?, updated_at = ?, completed_at = ?
        WHERE id = ? AND status = 'active' AND state_version = ?
      `).run(
        nextRoomId, JSON.stringify(session.state), terminalStatus, timestamp,
        terminalStatus === 'active' ? null : timestamp,
        session.id, expectedVersion,
      );
      if (update.changes !== 1) return { success: false, reason: 'Aksi sudah diproses.' };
      const updated = this.get(session.id, userId);
      let rewarded = false;
      if (terminalStatus === 'completed') {
        rewarded = db.transaction(() => awardCompletion(updated))();
        onEvent(userId, {
          key: `dungeon_complete:${session.id}:${userId}`,
          type: 'dungeon_complete',
          target: session.dungeon_id,
          amount: 1,
        });
        if (session.partner_id) {
          onEvent(session.partner_id, {
            key: `dungeon_complete:${session.id}:${session.partner_id}`,
            type: 'dungeon_complete', target: session.dungeon_id, amount: 1,
          });
        }
      }
      return { success: true, session: updated, room: nextRoom, rewarded };
    },
  };
}

module.exports = {
  DUNGEONS_FILE,
  SESSION_TTL_SECONDS,
  validateDungeon,
  loadDungeons,
  publishDungeons,
  createLongDungeonService,
};
