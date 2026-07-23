// src/rpg/controller.js
// Main RPG entry point — menghubungkan semua modul
// Sistem lama (Aldenmoor v2 / branching story) sudah DIGANTIKAN sepenuhnya.

const { setupProfile } = require('./profile');
const { setupGrind } = require('./grind');
const { setupEconomy, resolveInvInput } = require('./economy');
const { setupCoop, clearRaidSession } = require('./coop');
const { setupHelp } = require('./help');
const { setupDuel } = require('./duel');
const { setupWorld } = require('./world');
const { setupSkills } = require('./skills');
const { setupLongDungeon } = require('./longDungeon');
const { setupCampaign } = require('./campaign');
const { setupProfessions } = require('./professions');
const { setupMarketplace } = require('./marketplace');
const { setupEndgame } = require('./endgame');
const { setupSocial } = require('./social');
const { setupRaids } = require('./raids');
const { setupCoopActivities } = require('./coopActivities');
const { setupEquipment } = require('./equipment');
const { setupGuide } = require('./guide');

function setupRpg(bot, { getPartnerId, rateLimitCommand }) {
  // RPG v2: menu utama, region, campaign, dan eksplorasi.
  setupWorld(bot, { rateLimitCommand });
  setupSkills(bot, { rateLimitCommand });
  setupLongDungeon(bot, { rateLimitCommand });
  setupCampaign(bot, { rateLimitCommand });
  setupProfessions(bot, { rateLimitCommand });
  setupMarketplace(bot, { rateLimitCommand });
  setupEndgame(bot, { rateLimitCommand });
  setupSocial(bot, { getPartnerId, rateLimitCommand });
  setupRaids(bot, { rateLimitCommand });
  setupCoopActivities(bot, { rateLimitCommand });
  setupEquipment(bot, { rateLimitCommand });
  setupGuide(bot, { rateLimitCommand });

  // Fase 1: Profile & Character Creation
  setupProfile(bot, { rateLimitCommand });

  // Fase 2: Grinding core (/hunt, /fish, /mine)
  setupGrind(bot, { rateLimitCommand });

  // Fase 3 & 4: Economy (/inv, /shop, /buy, /sell, /use, /daily, /upgrade, /give)
  setupEconomy(bot, { getPartnerId, rateLimitCommand });

  // Fase 5: Co-op Dungeon Raid (/dungeon)
  setupCoop(bot, { getPartnerId, rateLimitCommand });

  // Fase 6: PvP Duel (/duel)
  setupDuel(bot, { getPartnerId, rateLimitCommand });

  // Help: /helprpg panduan lengkap
  setupHelp(bot, { rateLimitCommand });
}

module.exports = { setupRpg, clearRaidSession, resolveInvInput };
