const fs = require('fs');
const path = require('path');

function syncPatches() {
  const patchesDir = path.join(__dirname, 'patches');
  if (!fs.existsSync(patchesDir)) return;

  const allRegions = [];
  const allCampaigns = [];
  const allDungeons = [];
  const ITEM_ALIASES = { emas: 'emas_ore' };
  const normalizeRewards = value => {
    if (!value || typeof value !== 'object') return;
    if (value.item && ITEM_ALIASES[value.item]) value.item = ITEM_ALIASES[value.item];
    for (const nested of Object.values(value)) {
      if (nested && typeof nested === 'object') normalizeRewards(nested);
    }
  };

  function findJsonFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(findJsonFiles(fullPath));
      } else if (file.endsWith('.json')) {
        results.push(fullPath);
      }
    });
    return results;
  }

  const files = findJsonFiles(patchesDir);
  const patches = files
    .map(filePath => {
      try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (err) {
        console.error(`Error parsing patch file ${filePath}:`, err.message);
        return null;
      }
    })
    .filter(p => p && p.published === true);

  patches.sort((a, b) => (parseFloat(a.patch || 0) - parseFloat(b.patch || 0)));
  for (const patch of patches) {
    for (const collection of ['regions', 'campaigns', 'dungeons']) {
      for (const definition of patch[collection] || []) {
        const before = JSON.stringify(definition);
        normalizeRewards(definition);
        if (JSON.stringify(definition) !== before) {
          definition.version = Number(definition.version || 1) + 1;
        }
      }
    }
  }

  patches.forEach(p => {
    if (Array.isArray(p.regions)) allRegions.push(...p.regions);
    if (Array.isArray(p.campaigns)) allCampaigns.push(...p.campaigns);
    if (Array.isArray(p.dungeons)) allDungeons.push(...p.dungeons);
  });

  const regionsFile = path.join(__dirname, 'rpg_regions.json');
  const campaignsFile = path.join(__dirname, 'rpg_campaign.json');
  const dungeonsFile = path.join(__dirname, 'rpg_dungeons.json');

  // Write out merged configurations so that all existing database and service architectures work seamlessly
  fs.writeFileSync(regionsFile, JSON.stringify(allRegions, null, 2), 'utf8');
  fs.writeFileSync(campaignsFile, JSON.stringify(allCampaigns, null, 2), 'utf8');
  fs.writeFileSync(dungeonsFile, JSON.stringify(allDungeons, null, 2), 'utf8');

  return {
    regions: allRegions,
    campaigns: allCampaigns,
    dungeons: allDungeons,
    patchesLoaded: patches.map(p => `v${p.patch} (${p.title})`),
  };
}

// Automatically execute on import
syncPatches();

module.exports = { syncPatches };
