const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

test('shop terpadu memiliki nomor unik dan seluruh item tersedia di katalog', () => {
  const shop = JSON.parse(fs.readFileSync(path.join(root, 'data/rpg_shops.json'), 'utf8'));
  const combined = [...shop.shop_items, ...shop.special_shop]
    .map((item, index) => ({ ...item, number: index + 1 }));
  assert.equal(new Set(combined.map(item => item.number)).size, combined.length);

  const catalogSources = [
    fs.readFileSync(path.join(root, 'src/rpg/db_rpg.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/rpg/migrations.js'), 'utf8'),
  ].join('\n');
  for (const item of combined) {
    assert.match(catalogSources, new RegExp(`['"]${item.item_id}['"]`), item.item_id);
  }
});

test('seluruh hasil dan material crafting memiliki jalur katalog', () => {
  const crafting = JSON.parse(fs.readFileSync(path.join(root, 'data/rpg_crafting.json'), 'utf8'));
  const sources = [
    fs.readFileSync(path.join(root, 'src/rpg/db_rpg.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'src/rpg/migrations.js'), 'utf8'),
  ].join('\n');
  const ids = new Set(crafting.recipes.flatMap(recipe => [
    recipe.result,
    ...recipe.materials.map(material => material.item),
  ]));
  for (const id of ids) assert.match(sources, new RegExp(`['"]${id}['"]`), id);
});

test('reward hasil agregasi memakai item valid dan tool shop tersambung ke gathering', () => {
  require('../data/patch_loader').syncPatches();
  const campaigns = JSON.parse(fs.readFileSync(path.join(root, 'data/rpg_campaign.json'), 'utf8'));
  const dungeons = JSON.parse(fs.readFileSync(path.join(root, 'data/rpg_dungeons.json'), 'utf8'));
  const rewards = [
    ...campaigns.map(quest => quest.rewards),
    ...dungeons.flatMap(dungeon => [
      dungeon.rewards,
      ...dungeon.rooms.map(room => room.reward),
    ]),
  ].filter(Boolean);
  assert.equal(rewards.some(reward => reward.item === 'emas'), false);

  const grind = fs.readFileSync(path.join(root, 'src/rpg/grind.js'), 'utf8');
  assert.match(grind, /getItem\(userId, 'kail_plus'\)/);
  assert.match(grind, /getItem\(userId, 'beliung_plus'\)/);
});
