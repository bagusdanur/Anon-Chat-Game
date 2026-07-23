const { Markup } = require('telegraf');
const { db } = require('../db');
const { determineNextStep } = require('./services/gameplayGuide');

function readGuideState(userId) {
  const id = String(userId);
  const user = db.prepare('SELECT level FROM rpg_users WHERE telegram_user_id=?').get(id);
  if (!user) return { hasCharacter: false };
  const hasAlias = Boolean(db.prepare('SELECT 1 ok FROM rpg_character_aliases WHERE user_id=?').get(id));
  const skillCount = db.prepare(
    'SELECT count(1) count FROM rpg_user_skills WHERE user_id=? AND equipped_slot IS NOT NULL',
  ).get(id).count;
  const world = db.prepare('SELECT exploration_points FROM rpg_world_progress WHERE user_id=?').get(id);
  const dungeonClear = db.prepare(
    "SELECT 1 ok FROM rpg_dungeon_sessions_v2 WHERE (owner_id=? OR partner_id=?) AND status='completed' LIMIT 1",
  ).get(id, id);
  const party = db.prepare('SELECT 1 ok FROM rpg_party_members WHERE user_id=? LIMIT 1').get(id);
  return {
    hasCharacter: true,
    hasAlias,
    hasSkill: skillCount > 0,
    explorationPoints: world?.exploration_points || 0,
    hasDungeonClear: Boolean(dungeonClear),
    hasParty: Boolean(party),
    level: user.level,
  };
}

function renderGuide(userId) {
  const state = readGuideState(userId);
  const next = determineNextStep(state);
  const mark = value => value ? '✅' : '⬜';
  const phases = state.hasCharacter
    ? [
      `${mark(state.hasAlias)} 1. Karakter dan alias`,
      `${mark(state.hasSkill)} 2. Skill dan build awal`,
      `${mark(state.explorationPoints >= 3)} 3. World, campaign, dan petunjuk`,
      `${mark(state.hasDungeonClear)} 4. Dungeon panjang pertama`,
      `${mark(state.hasParty)} 5. Anonymous party dan aktivitas duo`,
      `${state.hasDungeonClear && state.hasParty ? '🔓' : '🔒'} 6. Season, tower, raid, dan koleksi`,
    ]
    : ['⬜ 1. Karakter dan alias', '🔒 2–6. Terbuka setelah karakter dibuat'];
  return {
    text:
      `<b>🧭 PANDUAN ALUR RPG</b>\n\n${phases.join('\n')}\n\n` +
      `<b>➡️ LANGKAHMU SEKARANG</b>\n` +
      `<b>${next.title}</b>\n${next.detail}\n\n` +
      `Gunakan <code>${next.command}</code>\n\n` +
      `<i>Solo selalu bisa maju. Co-op mempercepat dan membuka mekanik kerja sama tanpa membocorkan identitas Telegram.</i>`,
    next,
  };
}

function setupGuide(bot, { rateLimitCommand }) {
  function show(ctx) {
    const guide = renderGuide(ctx.chat.id);
    return ctx.reply(guide.text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('▶️ Cara Jalankan Langkah Ini', `guide:next:${guide.next.key}`)],
        [
          Markup.button.callback('🌍 World', 'guide:hint:world'),
          Markup.button.callback('🤝 Co-op', 'guide:hint:coop'),
          Markup.button.callback('🏰 Dungeon', 'guide:hint:dungeon'),
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
    return ctx.reply(`➡️ Langkah berikutnya: ${guide.next.command}\n${guide.next.detail}`);
  });
  bot.action(/^guide:hint:(world|coop|dungeon)$/, ctx => {
    const hints = {
      world: '🌍 Alur world: /world → /campaign → /explore → /dungeon.',
      coop: '🤝 Alur co-op: /search → /party create → /party invite → partner /party accept → /coop.',
      dungeon: '🏰 Solo: /dungeon solo 1. Duo: /dungeon duo 1. Raid klasik: /dungeon raid.',
    };
    ctx.answerCbQuery();
    return ctx.reply(hints[ctx.match[1]]);
  });
}

module.exports = { readGuideState, renderGuide, setupGuide };
