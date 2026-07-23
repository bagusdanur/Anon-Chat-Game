const { anonymousAlias } = require('./endgame');
const { createLedgerService } = require('./ledger');

const PARTY_CAPACITY = 4;
const PARTY_INVITE_TTL_SECONDS = 10 * 60;
const GUILD_CAPACITY = 20;
const GUILD_CREATE_COST = 1000;

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
        return { success: true, guildId };
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
      if (count >= GUILD_CAPACITY) return { success: false, reason: 'Guild sudah penuh.' };
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
        ledger.record({
          entryKey: `guild_contribution:${contributionId}`, userId, amount: -amount,
          balanceAfter: user.gold - amount, reason: 'guild_contribution',
          referenceType: 'guild', referenceId: guild.id,
        });
      })();
      return { success: true, guildId: guild.id };
    },
  };
}

module.exports = {
  PARTY_CAPACITY, PARTY_INVITE_TTL_SECONDS, GUILD_CAPACITY, GUILD_CREATE_COST,
  createSocialService,
};
