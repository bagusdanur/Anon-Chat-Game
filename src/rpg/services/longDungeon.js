const fs = require('fs');
const path = require('path');
const { createLedgerService } = require('./ledger');
const { createEquipmentService } = require('./equipment');

const DUNGEONS_FILE = path.join(__dirname, '../../../data/rpg_dungeons.json');
const SESSION_TTL_SECONDS = 24 * 60 * 60;
const INVITE_TTL_SECONDS = 10 * 60;

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

  function getAlias(userId) {
    return db.prepare('SELECT alias FROM rpg_character_aliases WHERE user_id = ?')
      .get(String(userId))?.alias || 'Petualang Anonim';
  }

  function enemyMaxHp(session, room) {
    const base = Math.max(8, room.enemy.power * (room.type === 'boss' ? 4 : 3));
    return Math.floor(base * (session.mode === 'duo' ? 1.8 : 1));
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
      if (reward.gold) {
      db.prepare('UPDATE rpg_users SET gold = MIN(50000, gold + ?), updated_at = ? WHERE telegram_user_id = ?')
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
      if (reward.xp) {
        const user = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(recipientId);
      let level = user.level;
      let xp = user.xp + reward.xp;
      while (xp >= xpToNextLevel(level)) {
        xp -= xpToNextLevel(level);
        level++;
      }
      const stats = calcStats(user.class_name, level);
      if (stats) {
        db.prepare(`
          UPDATE rpg_users
          SET level = ?, xp = ?, max_hp = ?, atk = ?, def = ?, magic_atk = ?,
              crit_rate = ?, crit_multi = ?, updated_at = ?
          WHERE telegram_user_id = ?
        `).run(
            level, xp, stats.max_hp, stats.atk, stats.def, stats.magic_atk,
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

  function resolveTacticalTurn(session, room, actor, ally, action) {
    const state = session.state;
    const actorPower = calculatePower(actor);
    const allyPower = ally ? calculatePower(ally) : Math.floor(actorPower * 0.15);
    const power = actorPower + Math.floor(allyPower * (ally ? 0.3 : 1));
    const maxEnemyHp = enemyMaxHp(session, room);
    if (!state.combat || state.combat.roomId !== room.id) {
      state.combat = {
        roomId: room.id,
        enemyHp: maxEnemyHp,
        maxEnemyHp,
        turn: 1,
        skillCooldown: 0,
        combo: 0,
      };
    }
    const combat = state.combat;
    if (!['attack', 'defend', 'skill', 'combo'].includes(action)) {
      return { success: false, reason: 'Pilih Attack, Defend, Skill, atau Combo.' };
    }
    if (action === 'skill' && combat.skillCooldown > 0) {
      return { success: false, reason: `Skill masih cooldown ${combat.skillCooldown} turn.` };
    }
    if (action === 'combo' && (session.mode !== 'duo' || combat.combo < 3)) {
      return { success: false, reason: 'Combo duo membutuhkan 3 energi kerja sama.' };
    }

    const multiplier = action === 'combo' ? 1.1
      : action === 'skill' ? 0.8 : action === 'defend' ? 0.25 : 0.5;
    let dealt = Math.max(1, Math.floor(power * multiplier * (0.9 + random() * 0.2)));
    const critRate = Math.min(0.5, Math.max(0, actor.crit_rate || 0));
    const critical = random() < critRate;
    if (critical) dealt = Math.max(1, Math.floor(dealt * (actor.crit_multi || 1.5)));
    combat.enemyHp = Math.max(0, combat.enemyHp - dealt);
    if (action === 'skill') combat.skillCooldown = 2;
    if (session.mode === 'duo') {
      combat.combo = action === 'combo' ? 0 : Math.min(3, combat.combo + 1);
    }
    const defeated = combat.enemyHp <= 0;
    const incomingScale = session.mode === 'duo' ? 1.2 : 1;
    const incoming = defeated
      ? 0
      : Math.max(1, Math.floor(
        room.enemy.damage * incomingScale *
        (action === 'defend' ? 0.35 : action === 'combo' ? 0.5 : 1),
      ));
    state.hp = Math.max(0, state.hp - incoming);
    if (action !== 'skill' && combat.skillCooldown > 0) combat.skillCooldown--;
    state.log = `Turn ${combat.turn}: ${action}${critical ? ' CRIT' : ''} memberi ${dealt} damage · menerima ${incoming} damage`;
    combat.turn++;

    if (state.hp <= 0) {
      delete state.combat;
      return { success: true, nextRoomId: room.failure, transitioned: true };
    }
    if (defeated) {
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
    const maxHp = owner.max_hp + partner.max_hp;
    const state = {
      hp: maxHp, maxHp, companion: 'Partner Party', collected: {},
      visited: [definition.entry_room], log: 'Undangan diterima. Ekspedisi duo dimulai.',
      turnOrder: [String(owner.user_id), String(partner.user_id)],
      turnAliases: [getAlias(owner.user_id), getAlias(partner.user_id)],
      turnIndex: 0,
      actionNumber: 1,
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
      const state = {
        hp: user.hp,
        maxHp: user.max_hp,
        companion: user.class_name === 'ksatria' ? 'Arcanist Mira' : 'Guardian Rowan',
        collected: {},
        visited: [JSON.parse(definitionRow.definition_json).entry_room],
        log: 'Ekspedisi dimulai.',
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
      if (session.mode === 'duo') {
        const expectedActor = session.state.turnOrder?.[session.state.turnIndex || 0];
        if (expectedActor && expectedActor !== String(userId)) {
          const alias = session.state.turnAliases?.[session.state.turnIndex || 0] || 'partner';
          return { success: false, reason: `Tunggu giliran ${alias}.` };
        }
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
        if (terminalStatus === 'active') {
          session.state.turnIndex = ((session.state.turnIndex || 0) + 1) % 2;
          const nextAlias = session.state.turnAliases?.[session.state.turnIndex] || 'partner';
          session.state.log = `${session.state.log || 'Aksi diproses.'} · giliran ${nextAlias}`;
        }
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
