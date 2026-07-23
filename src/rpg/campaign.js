const { db } = require('../db');
const { getOrCreateUser } = require('./db_rpg');
const { loadCampaign, publishCampaign, createCampaignService } = require('./services/campaign');

function setupCampaign(bot, { rateLimitCommand }) {
  publishCampaign(db, loadCampaign());
  const service = createCampaignService(db);

  bot.command('campaign', rateLimitCommand, ctx => {
    if (!getOrCreateUser(ctx.chat.id)) {
      return ctx.reply('Buat karakter terlebih dahulu dengan /profile.');
    }
    const quests = service.list(ctx.chat.id);
    if (quests.length === 0) return ctx.reply('Belum ada campaign yang terbuka.');
    const lines = quests.map(quest => {
      const icon = quest.status === 'completed' || quest.status === 'claimed' ? '✅' : '📜';
      const objectives = quest.definition.objectives.map(objective => {
        const current = quest.progress[objective.id] || 0;
        return `   ${current}/${objective.count} ${objective.id.replace(/_/g, ' ')}`;
      }).join('\n');
      return `${icon} <b>Chapter ${quest.chapter}: ${quest.title}</b>\n${objectives}`;
    });
    return ctx.reply(
      `<b>📖 CAMPAIGN ALDENMOOR</b>\n\n${lines.join('\n\n')}\n\n` +
      `<i>Gunakan /world dan /adventure untuk melanjutkan objective.</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupCampaign };
