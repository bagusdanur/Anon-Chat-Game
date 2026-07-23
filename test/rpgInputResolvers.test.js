const test = require('node:test');
const assert = require('node:assert/strict');
const {
  orderInventory,
  resolveNumberedId,
} = require('../src/rpg/inputResolvers');

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
