const fs = require('fs');
const path = require('path');

const SETTINGS_FILE = path.join(__dirname, '../../data/game_settings.json');

const DEFAULT_SETTINGS = {
  exp_multiplier: 1.0,
  gold_multiplier: 1.0,
  drop_rate_multiplier: 1.0,
  grind_cooldown_minutes: 60,
  daily_reward: {
    gold: 80,
    xp: 25,
    item: "ramuan_kecil"
  },
  upgrade_settings: {
    base_gold_cost: 100,
    base_ore_cost: 3,
    allowed_ores: ["besi_rongsok", "tembaga", "batu_bara", "besi", "perak", "emas_ore"]
  }
};

function getGameSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return { ...DEFAULT_SETTINGS, ...data };
    }
  } catch (e) {
    console.error('[RPG Config] Error reading game_settings.json:', e);
  }
  return DEFAULT_SETTINGS;
}

function saveGameSettings(settings) {
  const newSettings = { ...getGameSettings(), ...settings };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2));
  return newSettings;
}

module.exports = {
  getGameSettings,
  saveGameSettings
};
