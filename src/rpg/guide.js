const { Markup } = require('telegraf');
const { db } = require('../db');
const { determineNextStep, getCompletedChecklist, getClassBuildAdvice } = require('./services/gameplayGuide');
const { createCampaignService } = require('./services/campaign');

const campaignService = createCampaignService(db);

function readGuideState(userId) {
  const id = String(userId);
  const user = db.prepare('SELECT level FROM rpg_users WHERE telegram_user_id=?').get(id);
  if (!user) return { hasCharacter: false };
  const hasAlias = Boolean(db.prepare('SELECT 1 ok FROM rpg_character_aliases WHERE user_id=?').get(id));
  const world = db.prepare(`
    SELECT p.exploration_points, p.campaign_chapter, r.name region_name
    FROM rpg_world_progress p
    LEFT JOIN rpg_regions r ON r.region_id=p.current_region_id
    WHERE p.user_id=?
  `).get(id);
  const activeDungeonRow = db.prepare(`
    SELECT s.current_room_id, s.state_json, d.name, d.definition_json
    FROM rpg_dungeon_sessions_v2 s
    JOIN rpg_dungeon_definitions d ON d.dungeon_id=s.dungeon_id
    WHERE (s.owner_id=? OR s.partner_id=?) AND s.status='active' AND s.expires_at>?
    ORDER BY s.id DESC LIMIT 1
  `).get(id, id, Math.floor(Date.now() / 1000));
  let activeDungeon = null;
  if (activeDungeonRow) {
    const definition = JSON.parse(activeDungeonRow.definition_json);
    const room = definition.rooms.find(item => item.id === activeDungeonRow.current_room_id);
    activeDungeon = { name: activeDungeonRow.name, roomName: room?.name || activeDungeonRow.current_room_id };
  }
  const party = db.prepare('SELECT 1 ok FROM rpg_party_members WHERE user_id=? LIMIT 1').get(id);
  const quests = campaignService.list(id);
  const activeQuestRow = quests.find(quest => quest.status === 'active');
  let activeQuest = null;
  let nextQuestTitle = null;
  if (activeQuestRow) {
    const objective = activeQuestRow.definition.objectives[0];
    activeQuest = {
      chapter: activeQuestRow.chapter,
      title: activeQuestRow.title,
      status: activeQuestRow.status,
      objective: {
        type: objective.type,
        label: objective.id.replace(/_/g, ' '),
        current: activeQuestRow.progress[objective.id] || 0,
        target: objective.count,
      },
    };
    nextQuestTitle = db.prepare(`
      SELECT title FROM rpg_campaign_definitions
      WHERE published=1 AND (chapter>? OR (chapter=? AND sort_order>?))
      ORDER BY chapter,sort_order LIMIT 1
    `).get(activeQuestRow.chapter, activeQuestRow.chapter, activeQuestRow.sort_order)?.title || null;
  }
  const ch1Quests = quests.filter(quest => quest.chapter === 1);
  const isChapter1Completed = ch1Quests.length > 0 && ch1Quests.every(quest => ['completed', 'claimed'].includes(quest.status));

  return {
    hasCharacter: true,
    hasAlias,
    explorationPoints: world?.exploration_points || 0,
    hasParty: Boolean(party),
    level: user.level,
    regionName: world?.region_name || 'Pinggiran Aldenmoor',
    chapter: activeQuest?.chapter || world?.campaign_chapter || 1,
    activeQuest,
    nextQuestTitle,
    activeDungeon,
    isChapter1Completed: isChapter1Completed || (world?.campaign_chapter > 1),
  };
}

function renderGuide(userId) {
  const state = readGuideState(userId);
  const next = determineNextStep(state);
  const checklist = getCompletedChecklist(state);
  const userRow = db.prepare('SELECT class_name FROM rpg_users WHERE telegram_user_id=?').get(String(userId));
  const buildAdvice = getClassBuildAdvice(userRow?.class_name);

  const objective = state.activeQuest?.objective;
  const filled = objective
    ? Math.min(10, Math.round((objective.current / objective.target) * 10))
    : 0;
  const progress = objective
    ? `${'█'.repeat(filled)}${'░'.repeat(10 - filled)} ${objective.current}/${objective.target}`
    : 'Campaign content saat ini selesai';
  const position = state.hasCharacter
    ? `🌍 <b>${state.regionName}</b> · Chapter ${state.chapter}\n` +
      `📜 <b>${state.activeQuest?.title || 'Campaign tersedia selesai'}</b>\n` +
      `🎯 ${objective?.label || 'Menunggu chapter berikutnya'}\n${progress}`
    : 'Karakter belum dibuat.';

  const checklistText = checklist
    .map(item => `${item.done ? '✅' : '⏳'} ${item.title}`)
    .join('\n');

  return {
    text:
      `<b>🧭 PROGRESS GUIDE</b>\n\n` +
      `<b>📍 POSISIMU SEKARANG</b>\n${position}\n\n` +
      `<b>➡️ YANG HARUS DILAKUKAN SEKARANG</b>\n` +
      `<b>${next.title}</b>\n${next.detail}\n` +
      `👉 Jalankan: <code>${next.command}</code>\n\n` +
      `<b>📋 CHECKLIST MILESTONE PROGRES</b>\n` +
      `${checklistText}\n\n` +
      `<b>💡 ARAHAN BUILD KARAKTER (${buildAdvice.className})</b>\n` +
      `• <b>Prioritas Stat:</b> ${buildAdvice.statFocus}\n` +
      `• <b>Fokus Equipment:</b> ${buildAdvice.gearFocus}\n` +
      `• <b>Combo Skill:</b> ${buildAdvice.skillCombo}\n` +
      `• <b>Perintah Build:</b> <code>/gear</code> · <code>/skill</code> · <code>/inv</code> · <code>/reforge</code> · <code>/socket</code>\n\n` +
      `<b>🔓 UNLOCK SETELAH INI</b>\n${next.unlock}\n\n` +
      `<i>/guide diperbarui otomatis mengikuti progress world, campaign, dan dungeon.</i>`,
    next,
    state,
  };
}

function setupGuide(bot, { rateLimitCommand }) {
  function show(ctx) {
    const guide = renderGuide(ctx.chat.id);
    return ctx.reply(guide.text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('▶️ Jalankan Perintah Ini', `guide:next:${guide.next.key}`)],
        [
          Markup.button.callback('🌍 World', 'guide:hint:world'),
          Markup.button.callback('📜 Campaign', 'guide:hint:campaign'),
          Markup.button.callback('🏰 Dungeon', 'guide:hint:dungeon'),
          Markup.button.callback('💡 Tips Build', 'guide:hint:build'),
        ],
      ]),
    });
  }

  bot.command('guide', rateLimitCommand, show);
  bot.action('guide:open', ctx => {
    ctx.answerCbQuery();
    return show(ctx);
  });
  bot.action(/^guide:next:([a-z]+)$/, ctx => {
    ctx.answerCbQuery();
    const guide = renderGuide(ctx.chat.id);
    return ctx.reply(`➡️ <b>Langkah Berikutnya:</b> <code>${guide.next.command}</code>\n${guide.next.detail}`, { parse_mode: 'HTML' });
  });
  bot.action(/^guide:hint:(world|campaign|dungeon|build)$/, ctx => {
    ctx.answerCbQuery();
    if (ctx.match[1] === 'build') {
      const userRow = db.prepare('SELECT class_name FROM rpg_users WHERE telegram_user_id=?').get(String(ctx.chat.id));
      const advice = getClassBuildAdvice(userRow?.class_name);
      let msg = `<b>💡 PANDUAN LENGKAP BUILD KARAKTER</b>\n\n`;
      msg += `Class: <b>${advice.className}</b>\n`;
      msg += `🎯 <b>Fokus Stat Utama:</b> ${advice.statFocus}\n`;
      msg += `🛡️ <b>Rekomendasi Equipment:</b> ${advice.gearFocus}\n`;
      msg += `⚔️ <b>Combo Skill Loadout:</b> ${advice.skillCombo}\n\n`;
      msg += `<b>📜 PERINTAH UNTUK BUILD KARAKTER:</b>\n`;
      advice.commands.forEach(item => {
        msg += `• <code>${item.cmd}</code> — ${item.desc}\n`;
      });
      return ctx.reply(msg, { parse_mode: 'HTML' });
    }
    const hints = {
      world: '🌍 Alur world: /world → /campaign → /explore → /dungeon.',
      campaign: '📜 /campaign menampilkan seluruh quest chapter; /guide memilih satu objective aktif untukmu.',
      dungeon: '🏰 Solo: /dungeon solo 1. Duo: /dungeon duo 1. Raid klasik: /dungeon raid.',
    };
    return ctx.reply(hints[ctx.match[1]]);
  });
}

module.exports = { readGuideState, renderGuide, setupGuide };
