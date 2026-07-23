const fs = require('fs');
const path = require('path');

const REGION_FILE = path.join(__dirname, '../../../data/rpg_regions.json');

function assertString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function validateRegion(region) {
  assertString(region.id, 'region.id');
  assertString(region.name, 'region.name');
  assertString(region.description, 'region.description');
  if (!Number.isInteger(region.min_level) || region.min_level < 1) {
    throw new TypeError(`region ${region.id}: min_level must be >= 1`);
  }
  if (!Array.isArray(region.encounters) || region.encounters.length === 0) {
    throw new TypeError(`region ${region.id}: encounters cannot be empty`);
  }
  let totalWeight = 0;
  const ids = new Set();
  for (const encounter of region.encounters) {
    assertString(encounter.id, `region ${region.id} encounter.id`);
    if (ids.has(encounter.id)) throw new TypeError(`duplicate encounter: ${encounter.id}`);
    ids.add(encounter.id);
    if (!Number.isFinite(encounter.weight) || encounter.weight <= 0) {
      throw new TypeError(`encounter ${encounter.id}: weight must be positive`);
    }
    totalWeight += encounter.weight;
  }
  if (totalWeight <= 0) throw new TypeError(`region ${region.id}: invalid encounter weights`);
  return region;
}

function loadRegions(filePath = REGION_FILE) {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(parsed)) throw new TypeError('Region content must be an array');
  const result = new Map();
  for (const region of parsed) {
    validateRegion(region);
    if (result.has(region.id)) throw new TypeError(`duplicate region: ${region.id}`);
    result.set(region.id, Object.freeze(region));
  }
  return result;
}

function publishRegions(db, regions) {
  const statement = db.prepare(`
    INSERT INTO rpg_regions
      (region_id, name, description, min_level, travel_cost, content_json,
       published, content_version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(region_id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      min_level = excluded.min_level,
      travel_cost = excluded.travel_cost,
      content_json = excluded.content_json,
      published = excluded.published,
      content_version = excluded.content_version,
      updated_at = excluded.updated_at
    WHERE excluded.content_version > rpg_regions.content_version
  `);
  const now = Math.floor(Date.now() / 1000);
  const publish = db.transaction(() => {
    for (const region of regions.values()) {
      statement.run(
        region.id,
        region.name,
        region.description,
        region.min_level,
        region.travel_cost || 0,
        JSON.stringify(region),
        region.published ? 1 : 0,
        region.version || 1,
        now,
      );
    }
  });
  publish();
}

module.exports = { REGION_FILE, validateRegion, loadRegions, publishRegions };
