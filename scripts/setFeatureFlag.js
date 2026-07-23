const { db } = require('../src/db');
require('../src/rpg/db_rpg');
const { createFeatureFlagService } = require('../src/rpg/services/featureFlags');

const enabled = process.argv[2] === 'true';
const keys = process.argv.slice(3);
if (!keys.length) {
  process.stderr.write('Usage: node scripts/setFeatureFlag.js <true|false> <flag...>\n');
  process.exitCode = 1;
} else {
  const flags = createFeatureFlagService(db);
  for (const key of keys) flags.set(key, enabled);
  process.stdout.write(`${JSON.stringify(flags.list(), null, 2)}\n`);
}
db.close();
