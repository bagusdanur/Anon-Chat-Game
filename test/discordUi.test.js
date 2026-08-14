const test = require('node:test');
const assert = require('node:assert/strict');
const { NAVIGATION, navigationRows, numberedActionRows } = require('../src/rpg/discordUi');

test('Discord navigation preserves ten RPG destinations across two pages', () => {
  assert.equal(NAVIGATION.length, 10);
  assert.equal(navigationRows('profile', 1).length, 2);
  assert.equal(navigationRows('guild', 2).length, 2);
});

test('active navigation button is marked without changing layout', () => {
  const rows = navigationRows('shop', 1);
  const labels = rows[0].components.map(button => button.data.label);
  assert.ok(labels.includes('Shop ✓'));
  assert.equal(rows[0].components.length, 5);
});

test('navigation page controls disable the current edge', () => {
  const first = navigationRows('profile', 1)[1].components;
  const second = navigationRows('profile', 2)[1].components;
  assert.equal(first[0].data.disabled, true);
  assert.equal(second[1].data.disabled, true);
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
  assert.match(source, /discord:shop:confirm/);
  assert.match(source, /discord:inv:action/);
  assert.doesNotMatch(source, /consumeInteraction|consumedInteractions/);
});