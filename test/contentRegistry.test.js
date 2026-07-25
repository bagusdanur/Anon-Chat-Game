const test = require('node:test');
const assert = require('node:assert/strict');
const contentRegistry = require('../src/rpg/services/contentRegistry');

test('loadRegions validates all aggregated regions without TypeError', () => {
  assert.doesNotThrow(() => {
    const regions = contentRegistry.loadRegions();
    assert.ok(regions.has('aldenmoor_outskirts'), 'Should load Aldenmoor Outskirts from Patch 1.0');
    assert.ok(regions.has('spider_lair_valley'), 'Should load Spider Lair Valley from Patch 1.1');
    assert.ok(regions.has('shadow_volcano'), 'Should load Shadow Volcano from Patch 1.2');
  });
});
