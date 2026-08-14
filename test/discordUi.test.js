const test = require('node:test');
const assert = require('node:assert/strict');
const { NAVIGATION, navigationRows, paginationRow, numberedActionRows } = require('../src/rpg/discordUi');

test('Discord global navigation stays compact and limited to core panels', () => {
  assert.deepEqual(NAVIGATION.map(([command]) => command), ['profile', 'inv', 'shop', 'gear', 'skill']);
  assert.equal(navigationRows('profile').length, 1);
});

test('active navigation button is marked without changing layout', () => {
  const rows = navigationRows('shop', 1);
  const labels = rows[0].components.map(button => button.data.label);
  assert.ok(labels.includes('Shop ✓'));
  assert.equal(rows[0].components.length, 5);
});

test('global navigation fits in one Discord action row', () => {
  assert.equal(navigationRows('profile')[0].components.length, 5);
});

test('numbered actions stay one-based and capped for Discord rows', () => {
  const rows = numberedActionRows('discord:item', Array.from({ length: 30 }), 'Use');
  assert.equal(rows.length, 4);
  assert.equal(rows[0].components[0].data.label, 'Use 1');
  assert.equal(rows[3].components[4].data.label, 'Use 20');
});
test('Discord UI exposes native transaction routes without double-click guard', () => {
  const source = require('fs').readFileSync(require('path').join(__dirname, '..', 'discord-bot.js'), 'utf8');
  assert.match(source, /discord:shop:item/);
  assert.match(source, /discord:shop:page/);
  assert.match(source, /discord:shop:confirm/);
  assert.match(source, /discord:inv:action/);
  assert.match(source, /discord:callback-select/);
  assert.match(source, /choices\.length > 5/);
  assert.match(source, /discord:inv:select/);
  assert.match(source, /discord:skill:select/);
  assert.match(source, /discord:gear:select/);
  assert.match(source, /item\.equipped_slot \? 'unequip' : 'equip'/);
  assert.match(source, /discord:ore:select/);
  assert.match(source, /discord:ore:quantity/);
  assert.match(source, /discord:duo:join/);
  assert.match(source, /discord:duo:decline/);
  assert.match(source, /Lebur Ore/);
  assert.match(source, /gearforge/);
  assert.doesNotMatch(source, /consumeInteraction|consumedInteractions/);
});

test('pagination controls always use unique Discord custom ids', () => {
  for (const [page, totalPages] of [[1, 1], [1, 3], [2, 3], [3, 3]]) {
    const ids = paginationRow('discord:inv', page, totalPages).components
      .map(button => button.data.custom_id);
    assert.equal(new Set(ids).size, ids.length);
  }
});
