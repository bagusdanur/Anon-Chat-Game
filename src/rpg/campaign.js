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
    const lines = quests.map((quest, index) => {
      const icon = quest.status === 'completed' || quest.status === 'claimed' ? '✅' : '📜';
      const objectives = quest.definition.objectives.map(objective => {
        const current = quest.progress[objective.id] || 0;
        return `   ${current}/${objective.count} ${objective.id.replace(/_/g, ' ')}`;
      }).join('\n');
      return `${icon} <code>[${index + 1}]</code> <b>Chapter ${quest.chapter}: ${quest.title}</b>\n${objectives}`;
    });
    const active = quests.find(quest => quest.status === 'active');
    const suggestion = active
      ? 'Mulai dari /world. Eksplorasi mengisi objective; saat petunjuk lengkap lanjut /dungeon.'
      : 'Objective selesai. Buka /world untuk melihat langkah berikutnya.';
    return ctx.reply(
      `✨ <b>[CURRENT SAGA: PATCH 1.1 - WEBS OF THE SILENT ABYSS]</b>\n` +
      `<b>📖 CHRONICLES OF ALDENMOOR</b>\n\n${lines.join('\n\n')}\n\n` +
      `<b>🧭 ARAHAN EKSPLORASI</b>\n${suggestion}\n\n` +
      `<i>⚔️ Catatan Saga: Gunakan fitur mabar (/coop), profesi kuno (/gather /mine /fish), dan perdagangan pasar (/market) untuk bertahan di Lembah Sutra Beracun!</i>`,
      { parse_mode: 'HTML' },
    );
  });
}

module.exports = { setupCampaign };
