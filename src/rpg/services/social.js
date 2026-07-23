const { anonymousAlias } = require('./endgame');
const { createLedgerService } = require('./ledger');

const PARTY_CAPACITY = 4;
const PARTY_INVITE_TTL_SECONDS = 10 * 60;
const GUILD_CAPACITY = 20;
const GUILD_CREATE_COST = 1000;
const GUILD_QUEST_TARGET = 1000;

function weeklyPeriod(timestamp) {
  const date = new Date(timestamp * 1000);
  const day = date.getUTCDay() || 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - day + 1));
  return monday.toISOString().slice(0, 10);
}

function createSocialService(db, options = {}) {
  const now = options.now || (() => Math.floor(Date.now() / 1000));
  const ledger = createLedgerService(db);

  function getAlias(userId) {
    return db.prepare('SELECT alias FROM rpg_character_aliases WHERE user_id = ?')
      .get(String(userId))?.alias || anonymousAlias(userId);
  }

  function getParty(userId) {
    const party = db.prepare(`
      SELECT p.* FROM rpg_parties p
      JOIN rpg_party_members m ON m.party_id = p.id
      WHERE m.user_id = ? AND p.status = 'active'
    `).get(String(userId));
    if (!party) return null;
    const members = db.prepare(`
      SELECT * FROM rpg_party_members WHERE party_id = ? ORDER BY role DESC, joined_at
    `).all(party.id).map(member => ({ ...member, alias: getAlias(member.user_id) }));
    return { ...party, members };
  }

  function resolveGuildMember(guildId, input) {
    const members = db.prepare(`
      SELECT * FROM rpg_guild_members
      WHERE guild_id=? ORDER BY contribution DESC, joined_at
    `).all(guildId);
    const number = Number(input);
    if (Number.isInteger(number) && number >= 1) return members[number - 1] || null;
    const wanted = String(input || '').toLowerCase();
    return members.find(member => getAlias(member.user_id).toLowerCase() === wanted);
  }

  function recordGuildQuest(guildId, amount, eventKey) {
    const period = weeklyPeriod(now());
    return db.transaction(() => {
      const receipt = db.prepare(`
        INSERT OR IGNORE INTO rpg_guild_quest_events
          (event_key,guild_id,period_key,quest_id,amount,created_at)
        VALUES (?,?,?,'weekly_treasury',?,?)
      `).run(String(eventKey), guildId, period, amount, now());
      if (receipt.changes === 0) return false;
      db.prepare(`
        INSERT INTO rpg_guild_quest_progress
          (guild_id,period_key,quest_id,current,target,status,updated_at)
        VALUES (?,?,'weekly_treasury',?,?,CASE WHEN ?>=? THEN 'completed' ELSE 'active' END,?)
        ON CONFLICT(guild_id,period_key,quest_id) DO UPDATE SET
          current=current+excluded.current,
          status=CASE WHEN current+excluded.current>=target THEN 'completed' ELSE status END,
          updated_at=excluded.updated_at
      `).run(guildId, period, amount, GUILD_QUEST_TARGET, amount, GUILD_QUEST_TARGET, now());
      return true;
    })();
  }

  return {
    getAlias,
    setAlias(userId, alias) {
      const cleaned = String(alias || '').trim();
      if (!/^[A-Za-z0-9_]{3,16}$/.test(cleaned)) {
        return { success: false, reason: 'Alias harus 3-16 karakter: huruf, angka, underscore.' };
      }
      try {
        db.prepare(`
          INSERT INTO rpg_character_aliases (user_id, alias, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET alias = excluded.alias, updated_at = excluded.updated_at
        `).run(String(userId), cleaned, now());
        return { success: true, alias: cleaned };
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return { success: false, reason: 'Alias sudah dipakai.' };
        throw error;
      }
    },
    getParty,
    createParty(userId) {
      if (getParty(userId)) return { success: false, reason: 'Kamu sudah berada dalam party.' };
      const timestamp = now();
      const id = db.transaction(() => {
        const partyId = db.prepare(`
          INSERT INTO rpg_parties (owner_id, created_at, updated_at) VALUES (?, ?, ?)
        `).run(String(userId), timestamp, timestamp).lastInsertRowid;
        db.prepare(`
          INSERT INTO rpg_party_members (user_id, party_id, role, joined_at)
          VALUES (?, ?, 'owner', ?)
        `).run(String(userId), partyId, timestamp);
        return partyId;
      })();
      return { success: true, partyId: id };
    },
    invite(userId, inviteeId) {
      const party = getParty(userId);
      if (!party) return { success: false, reason: 'Buat party terlebih dahulu.' };
      if (party.owner_id !== String(userId)) return { success: false, reason: 'Hanya owner dapat mengundang.' };
      if (party.members.length >= PARTY_CAPACITY) return { success: false, reason: 'Party sudah penuh.' };
      if (getParty(inviteeId)) return { success: false, reason: 'Partner sudah memiliki party.' };
      const timestamp = now();
      db.prepare(`
        UPDATE rpg_party_invites SET status = 'expired'
        WHERE invitee_id = ? AND status = 'pending'
      `).run(String(inviteeId));
      const id = db.prepare(`
        INSERT INTO rpg_party_invites
          (party_id, inviter_id, invitee_id, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(party.id, String(userId), String(inviteeId), timestamp + PARTY_INVITE_TTL_SECONDS, timestamp).lastInsertRowid;
      return { success: true, inviteId: id };
    },
    acceptInvite(userId) {
      if (getParty(userId)) return { success: false, reason: 'Kamu sudah memiliki party.' };
      const invite = db.prepare(`
        SELECT * FROM rpg_party_invites
        WHERE invitee_id = ? AND status = 'pending' AND expires_at > ?
        ORDER BY id DESC LIMIT 1
      `).get(String(userId), now());
      if (!invite) return { success: false, reason: 'Undangan tidak ditemukan atau kedaluwarsa.' };
      return db.transaction(() => {
        const count = db.prepare('SELECT count(1) count FROM rpg_party_members WHERE party_id = ?')
          .get(invite.party_id).count;
        if (count >= PARTY_CAPACITY) return { success: false, reason: 'Party sudah penuh.' };
        db.prepare(`
          INSERT INTO rpg_party_members (user_id, party_id, role, joined_at)
          VALUES (?, ?, 'member', ?)
        `).run(String(userId), invite.party_id, now());
        db.prepare("UPDATE rpg_party_invites SET status = 'accepted' WHERE id = ? AND status = 'pending'")
          .run(invite.id);
        return { success: true, partyId: invite.party_id };
      })();
    },
    leaveParty(userId) {
      const party = getParty(userId);
      if (!party) return { success: false, reason: 'Kamu tidak berada dalam party.' };
      db.transaction(() => {
        db.prepare('DELETE FROM rpg_party_members WHERE user_id = ?').run(String(userId));
        const remaining = db.prepare(`
          SELECT * FROM rpg_party_members WHERE party_id = ? ORDER BY joined_at LIMIT 1
        `).get(party.id);
        if (!remaining) {
          db.prepare("UPDATE rpg_parties SET status = 'disbanded', updated_at = ? WHERE id = ?")
            .run(now(), party.id);
        } else if (party.owner_id === String(userId)) {
          db.prepare("UPDATE rpg_party_members SET role = 'owner' WHERE user_id = ?").run(remaining.user_id);
          db.prepare('UPDATE rpg_parties SET owner_id = ?, updated_at = ? WHERE id = ?')
            .run(remaining.user_id, now(), party.id);
        }
      })();
      return { success: true };
    },
    getGuild(userId) {
      const guild = db.prepare(`
        SELECT g.*, m.role, m.contribution AS my_contribution
        FROM rpg_guilds g JOIN rpg_guild_members m ON m.guild_id = g.id
        WHERE m.user_id = ?
      `).get(String(userId));
      if (!guild) return null;
      const members = db.prepare(`
        SELECT user_id, role, contribution FROM rpg_guild_members
        WHERE guild_id = ? ORDER BY contribution DESC LIMIT 20
      `).all(guild.id).map(member => ({ ...member, alias: getAlias(member.user_id) }));
      return { ...guild, members };
    },
    createGuild(userId, tag, name) {
      if (this.getGuild(userId)) return { success: false, reason: 'Kamu sudah berada dalam guild.' };
      const cleanTag = String(tag || '').toUpperCase();
      const cleanName = String(name || '').trim();
      if (!/^[A-Z0-9]{2,5}$/.test(cleanTag)) return { success: false, reason: 'Tag harus 2-5 huruf/angka.' };
      if (!/^[A-Za-z0-9 _-]{3,24}$/.test(cleanName)) return { success: false, reason: 'Nama guild tidak valid.' };
      const user = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(String(userId));
      if (!user || user.gold < GUILD_CREATE_COST) return { success: false, reason: `Butuh ${GUILD_CREATE_COST}g.` };
      try {
        const guildId = db.transaction(() => {
          db.prepare('UPDATE rpg_users SET gold = gold - ?, updated_at = ? WHERE telegram_user_id = ?')
            .run(GUILD_CREATE_COST, now(), String(userId));
          const id = db.prepare(`
            INSERT INTO rpg_guilds (tag, name, owner_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(cleanTag, cleanName, String(userId), now(), now()).lastInsertRowid;
          db.prepare(`
            INSERT INTO rpg_guild_members (user_id, guild_id, role, joined_at)
            VALUES (?, ?, 'owner', ?)
          `).run(String(userId), id, now());
          ledger.record({
            entryKey: `guild_create:${id}`, userId, amount: -GUILD_CREATE_COST,
            balanceAfter: user.gold - GUILD_CREATE_COST, reason: 'guild_creation',
            referenceType: 'guild', referenceId: id,
          });
          return id;
        })();
        return { success: true, guildId, tag: cleanTag, name: cleanName };
      } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return { success: false, reason: 'Tag atau nama guild sudah dipakai.' };
        throw error;
      }
    },
    joinGuild(userId, tag) {
      if (this.getGuild(userId)) return { success: false, reason: 'Keluar dari guild lama terlebih dahulu.' };
      const guild = db.prepare('SELECT * FROM rpg_guilds WHERE tag = ? COLLATE NOCASE').get(tag);
      if (!guild) return { success: false, reason: 'Guild tidak ditemukan.' };
      const count = db.prepare('SELECT count(1) count FROM rpg_guild_members WHERE guild_id = ?').get(guild.id).count;
      const capacity = Math.min(50, GUILD_CAPACITY + Math.max(0, guild.level - 1) * 2);
      if (count >= capacity) return { success: false, reason: `Guild sudah penuh (${capacity} anggota).` };
      db.prepare(`
        INSERT INTO rpg_guild_members (user_id, guild_id, role, joined_at)
        VALUES (?, ?, 'member', ?)
      `).run(String(userId), guild.id, now());
      return { success: true, guild };
    },
    leaveGuild(userId) {
      const guild = this.getGuild(userId);
      if (!guild) return { success: false, reason: 'Kamu belum memiliki guild.' };
      db.transaction(() => {
        db.prepare('DELETE FROM rpg_guild_members WHERE user_id = ?').run(String(userId));
        const remaining = db.prepare(`
          SELECT * FROM rpg_guild_members WHERE guild_id = ?
          ORDER BY role = 'officer' DESC, contribution DESC, joined_at LIMIT 1
        `).get(guild.id);
        if (!remaining) {
          db.prepare('DELETE FROM rpg_guilds WHERE id = ?').run(guild.id);
        } else if (guild.owner_id === String(userId)) {
          db.prepare("UPDATE rpg_guild_members SET role = 'owner' WHERE user_id = ?")
            .run(remaining.user_id);
          db.prepare('UPDATE rpg_guilds SET owner_id = ?, updated_at = ? WHERE id = ?')
            .run(remaining.user_id, now(), guild.id);
        }
      })();
      return { success: true };
    },
    contribute(userId, amount) {
      const guild = this.getGuild(userId);
      if (!guild) return { success: false, reason: 'Kamu belum memiliki guild.' };
      if (!Number.isInteger(amount) || amount <= 0) return { success: false, reason: 'Jumlah tidak valid.' };
      const user = db.prepare('SELECT gold FROM rpg_users WHERE telegram_user_id = ?').get(String(userId));
      if (!user || user.gold < amount) return { success: false, reason: 'Gold tidak cukup.' };
      const timestamp = now();
      db.transaction(() => {
        db.prepare('UPDATE rpg_users SET gold = gold - ?, updated_at = ? WHERE telegram_user_id = ?')
          .run(amount, timestamp, String(userId));
        db.prepare('UPDATE rpg_guilds SET treasury = treasury + ?, updated_at = ? WHERE id = ?')
          .run(amount, timestamp, guild.id);
        db.prepare('UPDATE rpg_guild_members SET contribution = contribution + ? WHERE user_id = ?')
          .run(amount, String(userId));
        const contributionId = db.prepare(`
          INSERT INTO rpg_guild_contributions (guild_id, user_id, amount, created_at)
          VALUES (?, ?, ?, ?)
        `).run(guild.id, String(userId), amount, timestamp).lastInsertRowid;
        recordGuildQuest(guild.id, amount, `guild_contribution:${contributionId}`);
        ledger.record({
          entryKey: `guild_contribution:${contributionId}`, userId, amount: -amount,
          balanceAfter: user.gold - amount, reason: 'guild_contribution',
          referenceType: 'guild', referenceId: guild.id,
        });
      })();
      return { success: true, guildId: guild.id };
    },
    upgradeGuild(userId) {
      const guild = this.getGuild(userId);
      if (!guild) return { success: false, reason: 'Kamu belum memiliki guild.' };
      if (!['owner', 'officer'].includes(guild.role)) {
        return { success: false, reason: 'Hanya owner atau officer yang dapat upgrade.' };
      }
      const cost = guild.level * 1000;
      if (guild.treasury < cost) {
        return { success: false, reason: `Treasury kurang. Butuh ${cost}g.` };
      }
      return db.transaction(() => {
        const changed = db.prepare(`
          UPDATE rpg_guilds
          SET treasury=treasury-?, level=level+1, updated_at=?
          WHERE id=? AND treasury>=?
        `).run(cost, now(), guild.id, cost);
        if (changed.changes === 0) return { success: false, reason: 'Treasury berubah, coba lagi.' };
        const balanceAfter = guild.treasury - cost;
        db.prepare(`
          INSERT INTO rpg_guild_treasury_ledger
            (entry_key,guild_id,actor_id,amount,balance_after,reason,created_at)
          VALUES (?,?,?,?,?,'guild_upgrade',?)
        `).run(`guild_upgrade:${guild.id}:${guild.level + 1}`, guild.id, String(userId), -cost, balanceAfter, now());
        return {
          success: true,
          cost,
          newLevel: guild.level + 1,
          capacity: Math.min(50, GUILD_CAPACITY + guild.level * 2),
        };
      })();
    },
    healGuild(userId) {
      const guild = this.getGuild(userId);
      if (!guild) return { success: false, reason: 'Kamu belum memiliki guild.' };
      if (!['owner', 'officer'].includes(guild.role)) {
        return { success: false, reason: 'Hanya owner atau officer yang dapat memakai treasury.' };
      }
      const cost = 250;
      if (guild.treasury < cost) return { success: false, reason: `Treasury kurang. Butuh ${cost}g.` };
      return db.transaction(() => {
        const changed = db.prepare(`
          UPDATE rpg_guilds SET treasury=treasury-?,updated_at=?
          WHERE id=? AND treasury>=?
        `).run(cost, now(), guild.id, cost);
        if (changed.changes === 0) return { success: false, reason: 'Treasury berubah, coba lagi.' };
        db.prepare(`
          UPDATE rpg_users SET hp=max_hp,updated_at=?
          WHERE telegram_user_id IN (SELECT user_id FROM rpg_guild_members WHERE guild_id=?)
        `).run(now(), guild.id);
        const entryKey = `guild_heal:${guild.id}:${now()}`;
        db.prepare(`
          INSERT INTO rpg_guild_treasury_ledger
            (entry_key,guild_id,actor_id,amount,balance_after,reason,created_at)
          VALUES (?,?,?,?,?,'guild_heal',?)
        `).run(entryKey, guild.id, String(userId), -cost, guild.treasury - cost, now());
        return { success: true, cost };
      })();
    },
    getGuildQuest(userId) {
      const guild = this.getGuild(userId);
      if (!guild) return { success: false, reason: 'Kamu belum memiliki guild.' };
      const period = weeklyPeriod(now());
      db.prepare(`
        INSERT OR IGNORE INTO rpg_guild_quest_progress
          (guild_id,period_key,quest_id,current,target,status,updated_at)
        VALUES (?,?,'weekly_treasury',0,?,'active',?)
      `).run(guild.id, period, GUILD_QUEST_TARGET, now());
      const quest = db.prepare(`
        SELECT * FROM rpg_guild_quest_progress
        WHERE guild_id=? AND period_key=? AND quest_id='weekly_treasury'
      `).get(guild.id, period);
      return { success: true, guild, quest };
    },
    claimGuildQuest(userId) {
      const state = this.getGuildQuest(userId);
      if (!state.success) return state;
      if (!['owner', 'officer'].includes(state.guild.role)) {
        return { success: false, reason: 'Hanya owner atau officer yang dapat klaim.' };
      }
      if (state.quest.status === 'claimed') return { success: false, reason: 'Quest sudah diklaim.' };
      if (state.quest.current < state.quest.target) return { success: false, reason: 'Target quest belum tercapai.' };
      return db.transaction(() => {
        const changed = db.prepare(`
          UPDATE rpg_guild_quest_progress SET status='claimed', claimed_at=?, updated_at=?
          WHERE guild_id=? AND period_key=? AND quest_id='weekly_treasury' AND status='completed'
        `).run(now(), now(), state.guild.id, state.quest.period_key);
        if (changed.changes === 0) return { success: false, reason: 'Quest sudah diklaim.' };
        db.prepare('UPDATE rpg_guilds SET level=level+1, updated_at=? WHERE id=?')
          .run(now(), state.guild.id);
        return { success: true, newLevel: state.guild.level + 1 };
      })();
    },
    changeGuildRole(actorId, targetAlias, action) {
      const guild = this.getGuild(actorId);
      if (!guild) return { success: false, reason: 'Kamu belum memiliki guild.' };
      if (!['promote', 'demote', 'kick'].includes(action)) return { success: false, reason: 'Aksi tidak valid.' };
      const target = resolveGuildMember(guild.id, targetAlias);
      if (!target) return { success: false, reason: 'Anggota dengan alias itu tidak ditemukan.' };
      if (target.user_id === String(actorId)) return { success: false, reason: 'Tidak dapat menargetkan diri sendiri.' };
      if (target.role === 'owner') return { success: false, reason: 'Owner tidak dapat diubah melalui command ini.' };
      if (action !== 'kick' && guild.role !== 'owner') return { success: false, reason: 'Hanya owner yang dapat mengubah role.' };
      if (action === 'kick' && !['owner', 'officer'].includes(guild.role)) {
        return { success: false, reason: 'Hanya owner atau officer yang dapat kick.' };
      }
      if (guild.role === 'officer' && target.role !== 'member') {
        return { success: false, reason: 'Officer hanya dapat kick member.' };
      }
      if (action === 'promote' && target.role !== 'member') return { success: false, reason: 'Target bukan member.' };
      if (action === 'demote' && target.role !== 'officer') return { success: false, reason: 'Target bukan officer.' };
      db.transaction(() => {
        if (action === 'kick') {
          db.prepare('DELETE FROM rpg_guild_members WHERE guild_id=? AND user_id=?')
            .run(guild.id, target.user_id);
        } else {
          db.prepare('UPDATE rpg_guild_members SET role=? WHERE guild_id=? AND user_id=?')
            .run(action === 'promote' ? 'officer' : 'member', guild.id, target.user_id);
        }
        db.prepare(`
          INSERT INTO rpg_guild_role_audit (guild_id,actor_id,target_id,action,created_at)
          VALUES (?,?,?,?,?)
        `).run(guild.id, String(actorId), target.user_id, action, now());
      })();
      return { success: true, alias: getAlias(target.user_id), action };
    },
  };
}

module.exports = {
  PARTY_CAPACITY, PARTY_INVITE_TTL_SECONDS, GUILD_CAPACITY, GUILD_CREATE_COST,
  GUILD_QUEST_TARGET, weeklyPeriod,
  createSocialService,
};
