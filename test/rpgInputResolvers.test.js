const test = require('node:test');
const assert = require('node:assert/strict');
const {
  orderInventory,
  resolveNumberedId,
} = require('../src/rpg/inputResolvers');
const { upgradeOreBreakdown } = require('../src/rpg/economy');

test('numeric skill input resolves from the displayed one-based position', () => {
  const skills = [{ id: 'guard' }, { id: 'heavy_slash' }];
  assert.equal(resolveNumberedId(skills, '1'), 'guard');
  assert.equal(resolveNumberedId(skills, '2'), 'heavy_slash');
  assert.equal(resolveNumberedId(skills, '3'), null);
  assert.equal(resolveNumberedId(skills, 'guard'), 'guard');
});

test('inventory ordering stays consistent for every numeric legacy command', () => {
  const inventory = [
    { item_id: 'ore', category: 'material' },
    { item_id: 'ring', category: 'accessory' },
    { item_id: 'staff', category: 'staff' },
    { item_id: 'sword', category: 'weapon' },
    { item_id: 'potion', category: 'consumable' },
    { item_id: 'plate', category: 'armor' },
  ];
  assert.deepEqual(
    orderInventory(inventory).map(item => item.item_id),
    ['sword', 'staff', 'plate', 'ring', 'potion', 'ore'],
  );
});

test('upgrade ore summary exposes every eligible inventory material', () => {
  const summary = upgradeOreBreakdown([
    { item_id: 'besi_rongsok', display_name: 'Besi Rongsok', category: 'material', quantity: 62 },
    { item_id: 'perak', display_name: 'Perak', category: 'material', quantity: 40 },
    { item_id: 'emas_ore', display_name: 'Bijih Emas', category: 'material', quantity: 210 },
    { item_id: 'kristal_nexus', display_name: 'Kristal Nexus', category: 'material', quantity: 8 },
  ], ['besi_rongsok', 'tembaga', 'batu_bara', 'besi', 'perak', 'emas_ore']);
  assert.equal(summary.total, 312);
  assert.deepEqual(
    summary.entries.map(item => item.itemId),
    ['besi_rongsok', 'perak', 'emas_ore'],
  );
});
