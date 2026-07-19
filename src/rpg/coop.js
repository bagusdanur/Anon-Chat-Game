// src/rpg/coop.js
// Fase 5: /dungeon — co-op raid boss turn-based
const { Markup } = require('telegraf');
const {
  getOrCreateUser, getDungeonCooldown, setDungeonCooldown,
  addXp, addGold, addItem, updateHp, getCurrentHp,
  createDungeonRun, finalizeDungeonRun, CLASS_DEFS, getEquipmentBonus
} = require('./db_rpg');
const { renderHpBar } = require('./profile');

// In-memory raid state keyed by pairKey
const raidSessions = new Map();

function getPairKey(a, b) {
  return [a.toString(), b.toString()].sort().join(':');
}

// ===== BOSS TABLES (rebalanced) =====
// Formula target: 2 pemain di min level bisa menang dalam 8-12 turn jika bermain optimal
const BOSS_TIERS = [
  // Tier 1: 2x Lv1 = total ATK ~8/turn, boss HP seharusnya bisa habis ~10-12 turn
  { tier: 1, minAvgLv: 1,  maxAvgLv: 15, id: 'kepala_goblin',  name: 'Kepala Goblin',     baseHp: 80,   baseAtk: [5,8],   baseDef: 2,  xpReward: 200,  goldReward: 120, legendaryDrop: 'pedang_goblin'   },
  { tier: 2, minAvgLv: 16, maxAvgLv: 35, id: 'ratu_laba',      name: 'Ratu Laba-laba',    baseHp: 280,  baseAtk: [10,16], baseDef: 5,  xpReward: 500,  goldReward: 300, legendaryDrop: 'jaring_sutra'    },
  { tier: 3, minAvgLv: 36, maxAvgLv: 60, id: 'naga_bayangan',  name: 'Naga Bayangan',     baseHp: 550,  baseAtk: [18,26], baseDef: 9,  xpReward: 1200, goldReward: 700, legendaryDrop: 'sisik_naga'      },
  { tier: 4, minAvgLv: 61, maxAvgLv: 999,id: 'raja_terkutuk',  name: 'Raja Terkutuk',     baseHp: 900,  baseAtk: [26,38], baseDef: 13, xpReward: 2500, goldReward: 1500,legendaryDrop: 'mahkota_terkutuk' },
];

// Label & emoji per tier untuk tampilan menu
const TIER_LABELS = [
  { tier: 1, emoji: '🌿', label: 'Gua Goblin',        minLv: 1,  desc: 'Boss: Kepala Goblin',      reward: '150-280 XP · 75-140g' },
  { tier: 2, emoji: '🕸️', label: 'Sarang Laba-laba',  minLv: 16, desc: 'Boss: Ratu Laba-laba',     reward: '256-512 XP · 160g' },
  { tier: 3, emoji: '🔥', label: 'Gua Naga Bayangan', minLv: 36, desc: 'Boss: Naga Bayangan',      reward: '480-960 XP · 300g' },
  { tier: 4, emoji: '💀', label: 'Istana Terkutuk',   minLv: 61, desc: 'Boss: Raja Terkutuk',      reward: '800-1600 XP · 500g' },
];

function getBossTier(avgLevel) {
  return BOSS_TIERS.find(t => avgLevel >= t.minAvgLv && avgLevel <= t.maxAvgLv) || BOSS_TIERS[0];
}

function getBossTierById(tierId) {
  return BOSS_TIERS.find(t => t.tier === tierId) || BOSS_TIERS[0];
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ===== COMBAT RESOLUTION =====
function resolveTurn(raid, actions) {
  const logs = [];
  const boss = raid.boss;

  // Player actions
  for (const [uid, action] of Object.entries(actions)) {
    if (action.type === 'dead') continue;
    const player = raid.players[uid];
    if (!player || !player.alive) continue;

    if (action.type === 'attack') {
      const dmg = Math.max(1, player.atk - Math.floor(boss.def / 2) + randInt(-2, 3));
      boss.hp = Math.max(0, boss.hp - dmg);
      logs.push(`⚔️ ${player.className}: menyerang! *-${dmg} HP* bos`);
    } else if (action.type === 'skill') {
      const dmg = Math.max(2, Math.floor(player.atk * 1.8) - Math.floor(boss.def / 2));
      boss.hp = Math.max(0, boss.hp - dmg);
      player.skillCooldown = 3;
      logs.push(`🔮 ${player.className}: pakai skill! *-${dmg} HP* bos`);
    } else if (action.type === 'defend') {
      player.defending = true;
      logs.push(`🛡️ ${player.className}: mengambil posisi bertahan!`);
    } else if (action.type === 'item') {
      const healAmt = Math.floor(player.maxHp * 0.15);
      player.hp = Math.min(player.maxHp, player.hp + healAmt);
      logs.push(`🧪 ${player.className}: minum ramuan! *+${healAmt} HP*`);
    }
    // Cooldown tick
    if (player.skillCooldown > 0 && action.type !== 'skill') player.skillCooldown--;
  }

  if (boss.hp <= 0) return logs;

  // Boss attack
  const bossAtk = randInt(...boss.atkRange);
  const isTelegraph = raid.turnNumber % 3 === 0;

  // Enrage at 50% HP
  const enraged = boss.hp <= Math.floor(boss.maxHp / 2) && !raid.enrageAnnounced;
  if (enraged) {
    raid.enrageAnnounced = true;
    boss.atkRange[0] = Math.floor(boss.atkRange[0] * 1.3);
    boss.atkRange[1] = Math.floor(boss.atkRange[1] * 1.3);
    logs.push(`😡 **${boss.name} MENGAMUK! ATK meningkat 30%!**`);
  }

  for (const player of Object.values(raid.players)) {
    if (!player.alive) continue;
    let dmg = Math.max(1, bossAtk - Math.floor(player.def / 2) + randInt(-2, 3));
    if (player.defending) { dmg = Math.floor(dmg * 0.5); player.defending = false; }
    // Ksatria trait: -10% damage
    if (player.classId === 'ksatria') dmg = Math.floor(dmg * 0.9);
    player.hp = Math.max(0, player.hp - dmg);
    if (player.hp <= 0) {
      player.alive = false;
      logs.push(`💀 ${player.className} tumbang kena serangan bos!`);
    } else {
      logs.push(`👹 ${boss.name} menyerang ${player.className}: *-${dmg} HP*`);
    }
  }

  if (isTelegraph && boss.hp > 0) {
    logs.push(`⚠️ **${boss.name} bersiap untuk serangan berat! Gunakan BERTAHAN!**`);
  }

  raid.turnNumber++;
  return logs;
}

// ===== SEND COMBAT UI =====
function sendCombatUI(bot, raid, extraLogs = []) {
  const { chatIdA, chatIdB, pairKey, boss, players, turnNumber } = raid;
  const allLogs = [...extraLogs, ...raid.pendingLogs].join('\n');
  raid.pendingLogs = [];

  let msg = `⚔️ **RAID: ${boss.name}** ⚔️\n\n`;
  msg += `👹 **${boss.name}**: ${renderHpBar(boss.hp, boss.maxHp, 10)}\n\n`;
  msg += `🛡️ **PARTY STATUS:**\n`;

  for (const [uid, p] of Object.entries(players)) {
    if (p.alive) {
      msg += `${p.icon} ${p.className}: ${renderHpBar(p.hp, p.maxHp, 6)} (CD: ${p.skillCooldown})\n`;
    } else {
      msg += `${p.icon} ${p.className}: 💀 Tumbang\n`;
    }
  }

  if (allLogs) msg += `\n📝 **LOG:**\n${allLogs}\n`;

  const buttons = [
    [Markup.button.callback('🗡️ Serang', `raid:${pairKey}:${turnNumber}:attack`)],
    [
      Markup.button.callback('🛡️ Bertahan', `raid:${pairKey}:${turnNumber}:defend`),
      Markup.button.callback('🔮 Skill', `raid:${pairKey}:${turnNumber}:skill`),
    ],
  ];

  const sendToPlayer = (chatId) => {
    const p = players[chatId];
    if (p && p.alive) {
      bot.telegram.sendMessage(chatId, msg + `\n_Pilih aksi Turn ${turnNumber}:_`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      }).catch(() => {});
    } else {
      bot.telegram.sendMessage(chatId, msg + `\n_Kamu sudah tumbang. Menonton..._`, { parse_mode: 'Markdown' }).catch(() => {});
      raid.actions[chatId] = { type: 'dead' };
    }
  };

  sendToPlayer(chatIdA);
  sendToPlayer(chatIdB);
}

function checkRaidResolve(bot, pairKey) {
  const raid = raidSessions.get(pairKey);
  if (!raid) return;

  const { chatIdA, chatIdB, players, actions } = raid;
  const bothActed = actions[chatIdA] && actions[chatIdB];
  if (!bothActed) return;

  const logs = resolveTurn(raid, actions);
  raid.actions = {};
  raid.pendingLogs = logs;

  const isPartyDead = !players[chatIdA].alive && !players[chatIdB].alive;
  const isBossDead = raid.boss.hp <= 0;

  if (isBossDead) {
    // WIN — gunakan reward tetap per tier, bukan formula HP-based
    const xpReward = raid.boss.xpReward || Math.floor(raid.boss.maxHp * 2);
    const goldReward = raid.boss.goldReward || Math.floor(raid.boss.maxHp * 1.2);
    const lootWinner = Math.random() < 0.5 ? chatIdA : chatIdB;

    const xpResultA = addXp(chatIdA, xpReward);
    const xpResultB = addXp(chatIdB, xpReward);
    addGold(chatIdA, goldReward);
    addGold(chatIdB, goldReward);
    addItem(lootWinner, raid.boss.legendaryDrop);

    finalizeDungeonRun(raid.runId, 'win', { item: raid.boss.legendaryDrop, winner: lootWinner.toString() });
    raidSessions.delete(pairKey);

    // Cek level-up untuk masing-masing pemain
    const levelUpA = xpResultA.leveled && xpResultA.leveled.length > 0 ? `\n🎉 **${players[chatIdA].className} LEVEL UP!** → Lv **${xpResultA.newLevel}**!` : '';
    const levelUpB = xpResultB.leveled && xpResultB.leveled.length > 0 ? `\n🎉 **${players[chatIdB].className} LEVEL UP!** → Lv **${xpResultB.newLevel}**!` : '';

    const winMsgBase =
      logs.join('\n') + `\n\n🎉 **BOSS DIKALAHKAN!**\n` +
      `✨ +${xpReward} XP | 💰 +${goldReward}g untuk KEDUA pemain!\n` +
      `🟠 Drop Legendary: **${raid.boss.legendaryDrop.replace(/_/g, ' ')}** → ${players[lootWinner].className}!`;

    bot.telegram.sendMessage(chatIdA, winMsgBase + levelUpA, { parse_mode: 'Markdown' }).catch(() => {});
    bot.telegram.sendMessage(chatIdB, winMsgBase + levelUpB, { parse_mode: 'Markdown' }).catch(() => {});

    updateHp(chatIdA, players[chatIdA].hp);
    updateHp(chatIdB, players[chatIdB].hp);
    return;
  }

  if (isPartyDead) {
    // LOSE
    const penaltyHpA = Math.floor(players[chatIdA].maxHp * 0.2);
    const penaltyHpB = Math.floor(players[chatIdB].maxHp * 0.2);
    updateHp(chatIdA, penaltyHpA);
    updateHp(chatIdB, penaltyHpB);
    finalizeDungeonRun(raid.runId, 'lose', null);
    raidSessions.delete(pairKey);

    const loseMsg =
      logs.join('\n') + `\n\n💀 **PARTY TUMBANG...**\n` +
      `HP kalian dipulihkan ke 20% max HP.\nCooldown dungeon 10 menit, setelah itu bisa raid lagi!`;
    bot.telegram.sendMessage(chatIdA, loseMsg, { parse_mode: 'Markdown' }).catch(() => {});
    bot.telegram.sendMessage(chatIdB, loseMsg, { parse_mode: 'Markdown' }).catch(() => {});
    return;
  }

  // Continue
  sendCombatUI(bot, raid);
}

function clearRaidSession(chatId, partnerId) {
  if (!partnerId) return;
  const key = getPairKey(chatId, partnerId);
  const raid = raidSessions.get(key);
  if (raid) {
    finalizeDungeonRun(raid.runId, 'abandoned', null);
    raidSessions.delete(key);
  }
}

function setupCoop(bot, { getPartnerId, rateLimitCommand }) {
  // Pending invite map
  const dungeonInvites = new Map();

  bot.command('dungeon', rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.reply('❌ Kamu harus sedang terhubung dengan partner (/search) untuk memulai dungeon!');

    const user = getOrCreateUser(userId);
    if (!user) return ctx.reply('⚠️ Buat karakter dulu dengan /profile!');
    const partner = getOrCreateUser(partnerId);
    if (!partner) return ctx.reply('❌ Partnermu belum punya karakter RPG. Minta dia /profile dulu!');

    const pairKey = getPairKey(userId, partnerId);
    if (raidSessions.has(pairKey)) return ctx.reply('⚔️ Raid sudah berjalan!');
    if (dungeonInvites.has(pairKey)) return ctx.reply('⏳ Sudah ada undangan dungeon yang menunggu konfirmasi!');

    // Cek cooldown dungeon (30 menit per pemain)
    const myCooldown = getDungeonCooldown(user);
    const partnerCooldown = getDungeonCooldown(partner);
    if (myCooldown > 0) {
      const mins = Math.ceil(myCooldown / 60);
      return ctx.reply(`⏳ Kamu masih cooldown dungeon! Bisa raid lagi dalam *${mins} menit*.`, { parse_mode: 'Markdown' });
    }
    if (partnerCooldown > 0) {
      const mins = Math.ceil(partnerCooldown / 60);
      return ctx.reply(`⏳ Partnermu masih cooldown dungeon! Bisa raid lagi dalam *${mins} menit*.`, { parse_mode: 'Markdown' });
    }

    // Tampilkan menu pilih kategori dungeon
    const avgLv = Math.floor((user.level + partner.level) / 2);
    const unlockedTiers = TIER_LABELS.filter(t => avgLv >= t.minLv);
    const lockedTiers = TIER_LABELS.filter(t => avgLv < t.minLv);

    let msg = `🏰 *Pilih Dungeon* 🏰\n\n`;
    msg += `📊 Rata-rata level party: *${avgLv}*\n`;
    msg += `⏳ Status: Siap raid!\n\n`;
    msg += `*Dungeon Tersedia:*\n`;
    for (const t of unlockedTiers) {
      msg += `${t.emoji} **${t.label}** _(Min. Lv ${t.minLv})_\n`;
      msg += `   ${t.desc}\n`;
      msg += `   💰 ${t.reward}\n\n`;
    }
    if (lockedTiers.length > 0) {
      msg += `*🔒 Belum Terbuka:*\n`;
      for (const t of lockedTiers) {
        msg += `🔒 ~~${t.label}~~ _(Min. Lv ${t.minLv})_\n`;
      }
    }
    msg += `\n_Pilih dungeon di bawah:_`;

    const buttons = unlockedTiers.map(t => [
      Markup.button.callback(`${t.emoji} ${t.label}`, `dungeon:pick:${t.tier}`)
    ]);
    buttons.push([Markup.button.callback('❌ Batal', 'dungeon:cancel')]);

    ctx.reply(msg, { parse_mode: 'Markdown', ...Markup.inlineKeyboard(buttons) });
  });

  // Pemain memilih tier dungeon → kirim undangan ke partner
  bot.action(/^dungeon:pick:(\d+)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.answerCbQuery('Kamu tidak punya partner aktif.', { show_alert: true });

    const tierId = parseInt(ctx.match[1]);
    const tierLabel = TIER_LABELS.find(t => t.tier === tierId);
    const bossTierDef = getBossTierById(tierId);
    if (!tierLabel || !bossTierDef) return ctx.answerCbQuery('Tier tidak valid.', { show_alert: true });

    const user = getOrCreateUser(userId);
    const partner = getOrCreateUser(partnerId);
    if (!user || !partner) return ctx.answerCbQuery('Data karakter tidak ditemukan.', { show_alert: true });

    const avgLv = Math.floor((user.level + partner.level) / 2);
    if (avgLv < tierLabel.minLv) {
      return ctx.answerCbQuery(`❌ Belum terbuka! Butuh rata-rata Lv ${tierLabel.minLv}.`, { show_alert: true });
    }

    const pairKey = getPairKey(userId, partnerId);
    if (raidSessions.has(pairKey) || dungeonInvites.has(pairKey)) {
      return ctx.answerCbQuery('Sudah ada sesi dungeon aktif!', { show_alert: true });
    }

    dungeonInvites.set(pairKey, { inviter: userId, invitee: partnerId, tierId });
    ctx.answerCbQuery(`Undangan ${tierLabel.label} dikirim!`);
    ctx.editMessageText(
      `${tierLabel.emoji} Kamu memilih **${tierLabel.label}**!\n\nMenunggu konfirmasi partner...`,
      { parse_mode: 'Markdown' }
    );

    bot.telegram.sendMessage(partnerId,
      `⚔️ **Undangan Dungeon Raid!**\n\n` +
      `Partnermu mengajak masuk ke **${tierLabel.emoji} ${tierLabel.label}**!\n\n` +
      `👹 ${tierLabel.desc}\n` +
      `💰 Reward: ${tierLabel.reward}\n` +
      `📊 Rata-rata level party: ${avgLv}\n\n` +
      `_Cooldown 10 menit aktif setelah raid selesai._`,
      {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('✅ Masuk!', 'dungeon:accept'), Markup.button.callback('❌ Tolak', 'dungeon:reject')]
        ])
      }
    ).catch(() => {});
  });

  bot.action('dungeon:cancel', rateLimitCommand, (ctx) => {
    ctx.answerCbQuery('Dibatalkan.');
    ctx.editMessageText('❌ Pemilihan dungeon dibatalkan.');
  });

  bot.action(/^dungeon:(accept|reject)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const partnerId = getPartnerId(userId);
    if (!partnerId) return ctx.answerCbQuery('Kamu tidak punya partner aktif.', { show_alert: true });

    const pairKey = getPairKey(userId, partnerId);
    const invite = dungeonInvites.get(pairKey);
    if (!invite) return ctx.answerCbQuery('Undangan sudah tidak valid.', { show_alert: true });
    if (invite.inviter === userId) return ctx.answerCbQuery('Tunggu partnermu yang merespons!', { show_alert: true });

    const action = ctx.match[1];
    dungeonInvites.delete(pairKey);

    if (action === 'reject') {
      ctx.answerCbQuery('Ditolak.');
      ctx.reply('❌ Kamu menolak undangan dungeon.');
      bot.telegram.sendMessage(partnerId, '❌ Partnermu menolak undangan dungeon.').catch(() => {});
      return;
    }

    // Accept — start raid, set cooldown LANGSUNG saat mulai
    const userA = getOrCreateUser(invite.inviter);
    const userB = getOrCreateUser(userId);

    // Set cooldown 30 menit untuk kedua pemain
    setDungeonCooldown(invite.inviter);
    setDungeonCooldown(userId);

    const avgLv = Math.floor((userA.level + userB.level) / 2);
    // Gunakan tier yang dipilih inviter, bukan auto-detect dari avgLv
    const bossTier = getBossTierById(invite.tierId) || getBossTier(avgLv);
    const scaledHp = Math.floor(bossTier.baseHp * (1 + (avgLv - bossTier.minAvgLv) * 0.03));

    const runId = createDungeonRun(invite.inviter, userId, bossTier.id);

    const clsA = CLASS_DEFS[userA.class_name];
    const clsB = CLASS_DEFS[userB.class_name];

    const raid = {
      pairKey,
      chatIdA: invite.inviter,
      chatIdB: userId,
      runId,
      turnNumber: 1,
      enrageAnnounced: false,
      boss: {
        id: bossTier.id,
        name: bossTier.name,
        hp: scaledHp,
        maxHp: scaledHp,
        atkRange: [...bossTier.baseAtk],
        def: bossTier.baseDef,
        legendaryDrop: bossTier.legendaryDrop,
        xpReward: bossTier.xpReward,
        goldReward: bossTier.goldReward,
      },
      players: {
        [invite.inviter]: {
          classId: userA.class_name,
          className: clsA.name,
          icon: clsA.name.split(' ')[0],
          hp: getCurrentHp(userA),
          maxHp: userA.max_hp,
          atk: userA.atk + getEquipmentBonus(invite.inviter).atkBonus,
          def: userA.def + getEquipmentBonus(invite.inviter).defBonus,
          skillCooldown: 0,
          alive: true,
          defending: false,
        },
        [userId]: {
          classId: userB.class_name,
          className: clsB.name,
          icon: clsB.name.split(' ')[0],
          hp: getCurrentHp(userB),
          maxHp: userB.max_hp,
          atk: userB.atk + getEquipmentBonus(userId).atkBonus,
          def: userB.def + getEquipmentBonus(userId).defBonus,
          skillCooldown: 0,
          alive: true,
          defending: false,
        },
      },
      actions: {},
      pendingLogs: [],
    };

    raidSessions.set(pairKey, raid);

    ctx.answerCbQuery('Raid dimulai!');
    const startMsg = `⚔️ **DUNGEON RAID DIMULAI!**\n\n👹 Boss: **${bossTier.name}**\n📊 Rata-rata level party: ${avgLv}\n\nCooldown 10 menit akan aktif setelah raid selesai.\n\nPersiapkan diri!`;
    bot.telegram.sendMessage(invite.inviter, startMsg, { parse_mode: 'Markdown' }).catch(() => {});
    bot.telegram.sendMessage(userId, startMsg, { parse_mode: 'Markdown' }).catch(() => {});

    setTimeout(() => sendCombatUI(bot, raid), 1500);
  });

  // Combat action handler
  bot.action(/^raid:(.+):(\d+):(attack|defend|skill|item)$/, rateLimitCommand, (ctx) => {
    const userId = ctx.chat.id;
    const [, pairKey, turnStr, actionType] = ctx.match;
    const turnNumber = parseInt(turnStr);

    const raid = raidSessions.get(pairKey);
    if (!raid) return ctx.answerCbQuery('Raid sudah selesai.', { show_alert: true });
    if (raid.turnNumber !== turnNumber) return ctx.answerCbQuery('Turn ini sudah berlalu.', { show_alert: true });
    if (raid.actions[userId]) return ctx.answerCbQuery('Kamu sudah memilih!', { show_alert: true });

    const player = raid.players[userId];
    if (!player || !player.alive) return ctx.answerCbQuery('Kamu sudah tumbang!', { show_alert: true });
    if (actionType === 'skill' && player.skillCooldown > 0) {
      return ctx.answerCbQuery(`Skill cooldown ${player.skillCooldown} turn!`, { show_alert: true });
    }

    raid.actions[userId] = { type: actionType };
    ctx.answerCbQuery('Aksi dikonfirmasi!');
    ctx.reply('⏳ Menunggu partner...');

    checkRaidResolve(bot, pairKey);
  });

  return { clearRaidSession };
}

module.exports = { setupCoop, clearRaidSession };
