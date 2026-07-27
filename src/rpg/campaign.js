const { db } = require('../db');
const { getOrCreateUser, calcStats, xpToNextLevel } = require('./db_rpg');
const { loadCampaign, publishCampaign, createCampaignService } = require('./services/campaign');
const { formatObjectiveLabel, getSagaHeader, getSagaFooter } = require('./services/gameplayGuide');
const { getGuideFlow } = require('./guide');

function setupCampaign(bot, { rateLimitCommand }) {
  publishCampaign(db, loadCampaign());
  const service = createCampaignService(db, { calcStats, xpToNextLevel });

  bot.command('campaign', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) {
      return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    }
    const quests = service.list(ctx.chat.id);
    if (quests.length === 0) return ctx.reply('Belum ada campaign yang terbuka.');
    const lines = quests.map((quest, index) => {
      const icon = quest.status === 'completed' || quest.status === 'claimed' ? '✅' : '📜';
      const objectives = quest.definition.objectives.map(objective => {
        const current = quest.progress[objective.id] || 0;
        return `   ${current}/${objective.count} ${formatObjectiveLabel(objective.id)}`;
      }).join('\n');
      return `${icon} <code>[${index + 1}]</code> <b>Chapter ${quest.chapter}: ${quest.title}</b>\n${objectives}`;
    });
    const active = quests.find(quest => quest.status === 'active');
    const currentCh = active ? active.chapter : (quests.length > 0 ? quests[quests.length - 1].chapter : 1);
    const flow = getGuideFlow(ctx.chat.id);
    const suggestion = `<b>${flow.next.title}</b>\n${flow.next.detail}\nJalankan: <code>${flow.next.command}</code>`;
    return ctx.reply(
      `${getSagaHeader(currentCh)}\n` +
      `<b>📖 CHRONICLES OF ALDENMOOR</b>\n\n${lines.join('\n\n')}\n\n` +
      `<b>🧭 ARAHAN EKSPLORASI</b>\n${suggestion}\n\n` +
      `${getSagaFooter(currentCh)}`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupCampaign };
