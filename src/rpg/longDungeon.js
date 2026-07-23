const { Markup } = require('telegraf');
const { db } = require('../db');
const { getOrCreateUser, xpToNextLevel, calcStats } = require('./db_rpg');
const { createFeatureFlagService } = require('./services/featureFlags');
const {
  loadDungeons, publishDungeons, createLongDungeonService,
} = require('./services/longDungeon');
const { loadCampaign, publishCampaign, createCampaignService } = require('./services/campaign');

function setupLongDungeon(bot, { rateLimitCommand }) {
  const flags = createFeatureFlagService(db);
  publishDungeons(db, loadDungeons());
  publishCampaign(db, loadCampaign());
  const campaign = createCampaignService(db);
  const service = createLongDungeonService(db, {
    xpToNextLevel,
    calcStats,
    onEvent: (userId, event) => campaign.recordEvent(userId, event),
  });

  function renderSession(session) {
    const room = service.getRoom(session);
    const combat = session.state.combat?.roomId === room.id
      ? session.state.combat
      : null;
    let text =
      `<b>${session.definition.name}</b>\n` +
      `📍 Room ${session.state.visited.length}: <b>${room.name}</b> · ${session.mode === 'duo' ? '🤝 DUO' : '🧍 SOLO'}\n\n` +
      `${room.text}\n\n` +
      `❤️ HP <b>${session.state.hp}/${session.state.maxHp}</b>\n` +
      `🤝 Companion: <b>${session.state.companion}</b>`;
    if (['combat', 'boss'].includes(room.type)) {
      const maxEnemyHp = combat?.maxEnemyHp || service.enemyMaxHp(session, room);
      const enemyHp = combat?.enemyHp ?? maxEnemyHp;
      text += `\n👹 ${room.enemy.name}: <b>${enemyHp}/${maxEnemyHp} HP</b>`;
      text += `\n\n💡 <i>Attack stabil · Defend mengurangi damage · Skill kuat dengan cooldown.</i>`;
      if (session.mode === 'duo') {
        const turnAlias = session.state.turnAliases?.[session.state.turnIndex || 0] || 'partner';
        text += `\n🤝 Giliran: <b>${turnAlias}</b> · Energi Combo: <b>${combat?.combo || 0}/3</b>`;
        text += `\n🤝 <i>Aksi wajib bergantian. Isi energi lalu gunakan Combo bersama.</i>`;
      }
    }
    if (session.state.log) text += `\n📝 ${session.state.log}`;

    const buttons = [];
    if (room.type === 'event') {
      for (const option of room.options || []) {
        buttons.push([Markup.button.callback(
          option.label,
          `ld:${session.id}:${session.state_version}:${option.id}`,
        )]);
      }
    } else if (['combat', 'boss'].includes(room.type)) {
      buttons.push([
        Markup.button.callback('⚔️ Attack', `ld:${session.id}:${session.state_version}:attack`),
        Markup.button.callback('🛡 Defend', `ld:${session.id}:${session.state_version}:defend`),
      ]);
      buttons.push([
        Markup.button.callback('✨ Skill', `ld:${session.id}:${session.state_version}:skill`),
        ...(session.mode === 'duo'
          ? [Markup.button.callback('🤝 Combo', `ld:${session.id}:${session.state_version}:combo`)]
          : []),
      ]);
    } else if (room.type === 'treasure') {
      buttons.push([Markup.button.callback(
        '🎁 Ambil Harta',
        `ld:${session.id}:${session.state_version}:claim`,
      )]);
    } else if (room.type === 'rest') {
      buttons.push([Markup.button.callback(
        '🔥 Istirahat',
        `ld:${session.id}:${session.state_version}:rest`,
      )]);
    }
    return {
      text,
      options: { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) },
    };
  }

  function showSession(ctx, session) {
    const rendered = renderSession(session);
    return ctx.reply(rendered.text, rendered.options);
  }

  function requireEnabled(ctx) {
    if (flags.isEnabled('long_dungeons_v2')) return true;
    ctx.reply('🛠 Dungeon panjang sedang dinonaktifkan sementara.');
    return false;
  }

  function startOrResume(ctx, dungeonId = 'goblin_ruins', mode = 'solo') {
    if (!requireEnabled(ctx)) return;
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const active = service.getActive(ctx.chat.id);
    if (active) {
      ctx.reply('♻️ Melanjutkan checkpoint ekspedisi terakhir.');
      return showSession(ctx, active);
    }
    const result = mode === 'duo'
      ? service.startDuo(ctx.chat.id, dungeonId)
      : service.startSolo(ctx.chat.id, dungeonId);
    if (!result.success) return ctx.reply(`❌ ${result.reason}`);
    return showSession(ctx, result.session);
  }

  function adventureMenu(ctx) {
    if (!requireEnabled(ctx)) return;
    const user = getOrCreateUser(ctx.chat.id);
    if (!user) return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    const active = service.getActive(ctx.chat.id);
    if (active) {
      return ctx.reply(
        `<b>🏰 DUNGEON PANJANG</b>\n\n♻️ Ada checkpoint aktif: <b>${active.definition.name}</b>\n` +
        `Mode: <b>${active.mode === 'duo' ? 'DUO' : 'SOLO'}</b>\n\n` +
        `<i>Tekan lanjut untuk kembali ke room terakhir.</i>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[
            Markup.button.callback('▶️ Lanjutkan Checkpoint', `adventure:resume:${active.id}`),
          ]]),
        },
      );
    }
    const dungeons = service.list(user.level);
    const list = dungeons.map((item, index) =>
      `<code>[${index + 1}]</code> <b>${item.name}</b> · masuk Lv.${item.min_level} · rekomendasi Lv.${item.recommended_level}`,
    ).join('\n');
    return ctx.reply(
      `<b>🏰 DUNGEON PANJANG — TURN-BASED</b>\n\n${list}\n\n` +
      `<b>Pilih mode:</b>\n🧍 Solo memakai companion NPC.\n` +
      `🤝 Duo direkomendasikan: HP digabung dan kedua pemain bergantian aksi.\n\n` +
      `<i>Contoh: /dungeon solo 1 atau /dungeon duo 1</i>`,
      {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🤝 Mulai Duo (Disarankan)', 'adventure:start:duo:1')],
          [Markup.button.callback('🧍 Mulai Solo', 'adventure:start:solo:1')],
        ]),
      },
    );
  }

  bot.command('adventure', rateLimitCommand, ctx => {
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    if (args.length === 0) return adventureMenu(ctx);
    const mode = args[0]?.toLowerCase() === 'duo' ? 'duo' : 'solo';
    const user = getOrCreateUser(ctx.chat.id);
    const dungeonNumber = Number(args[1] || (mode === 'solo' && args[0] !== 'solo' ? args[0] : 1));
    const dungeonId = service.list(user?.level || 1)[dungeonNumber - 1]?.dungeon_id;
    if (!dungeonId) return ctx.reply('❌ Nomor dungeon tidak valid. Ketik /dungeon.');
    return startOrResume(ctx, dungeonId, mode);
  });

  bot.action(/^adventure:start:(solo|duo):(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const user = getOrCreateUser(ctx.chat.id);
    const dungeonId = service.list(user?.level || 1)[Number(ctx.match[2]) - 1]?.dungeon_id;
    if (!dungeonId) return ctx.reply('❌ Dungeon tidak tersedia.');
    return startOrResume(ctx, dungeonId, ctx.match[1]);
  });
  bot.action(/^adventure:resume:(\d+)$/, async ctx => {
    await ctx.answerCbQuery();
    const session = service.get(Number(ctx.match[1]), ctx.chat.id);
    if (!session || session.status !== 'active') return ctx.reply('Checkpoint tidak tersedia.');
    return showSession(ctx, session);
  });

  // `/dungeon` adalah pintu utama dungeon panjang. Raid boss lama tetap
  // tersedia secara eksplisit melalui `/dungeon raid`.
  bot.command('dungeon', (ctx, next) => {
    const args = ctx.message.text.trim().split(/\s+/).slice(1);
    const action = args[0]?.toLowerCase();
    if (action === 'raid') return next();
    return rateLimitCommand(ctx, () => {
      if (!action) return adventureMenu(ctx);
      if (!['solo', 'duo'].includes(action)) {
        return ctx.reply(
          '❌ Gunakan /dungeon, /dungeon solo [nomor], /dungeon duo [nomor], atau /dungeon raid.',
        );
      }
      const user = getOrCreateUser(ctx.chat.id);
      const dungeonNumber = Number(args[1] || 1);
      const dungeonId = service.list(user?.level || 1)[dungeonNumber - 1]?.dungeon_id;
      if (!dungeonId) return ctx.reply('❌ Nomor dungeon tidak valid. Ketik /dungeon.');
      return startOrResume(ctx, dungeonId, action);
    });
  });

  bot.action(/^ld:(\d+):(\d+):([a-z0-9_]+)$/, rateLimitCommand, ctx => {
    if (!requireEnabled(ctx)) return ctx.answerCbQuery();
    const sessionId = Number(ctx.match[1]);
    const version = Number(ctx.match[2]);
    const optionId = ctx.match[3];
    const session = service.get(sessionId, ctx.chat.id);
    if (!session) return ctx.answerCbQuery('Checkpoint bukan milikmu.', { show_alert: true });
    const result = service.advance(ctx.chat.id, sessionId, version, optionId);
    if (!result.success) return ctx.answerCbQuery(result.reason, { show_alert: true });
    ctx.answerCbQuery('Checkpoint tersimpan.');
    if (result.session.status === 'completed') {
      return ctx.editMessageText(
        `<b>🏆 DUNGEON SELESAI!</b>\n\n${result.room.text}\n\n` +
        `✨ +${result.session.definition.rewards.xp} XP\n` +
        `💰 +${result.session.definition.rewards.gold}g\n` +
        `🎁 Loot dan harta room telah masuk inventory.`,
        { parse_mode: 'HTML' },
      );
    }
    if (result.session.status === 'failed') {
      return ctx.editMessageText(
        `<b>💀 EKSPEDISI GAGAL</b>\n\n${result.room.text}\n\n` +
        `Gunakan /dungeon untuk mencoba ekspedisi baru.`,
        { parse_mode: 'HTML' },
      );
    }
    const rendered = renderSession(result.session);
    return ctx.editMessageText(rendered.text, rendered.options);
  });
}

module.exports = { setupLongDungeon };
