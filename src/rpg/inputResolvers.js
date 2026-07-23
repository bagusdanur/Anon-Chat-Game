const INVENTORY_CATEGORY_ORDER = [
  ['weapon', '⚔️ Senjata'],
  ['staff', '🪄 Staff'],
  ['armor', '🛡️ Armor'],
  ['accessory', '💍 Aksesori'],
  ['consumable', '🧪 Konsumable'],
  ['material', '📦 Material'],
];

function resolveNumberedId(items, input) {
  if (!input) return input;
  const number = Number(input);
  if (Number.isInteger(number) && number >= 1) {
    return items[number - 1]?.id || null;
  }
  return input;
}

function orderInventory(items) {
  const categoryRank = new Map(
    INVENTORY_CATEGORY_ORDER.map(([category], index) => [category, index]),
  );
  return [...items].sort((left, right) => {
    const leftRank = categoryRank.get(left.category) ?? INVENTORY_CATEGORY_ORDER.length;
    const rightRank = categoryRank.get(right.category) ?? INVENTORY_CATEGORY_ORDER.length;
    return leftRank - rightRank;
  });
}

module.exports = {
  INVENTORY_CATEGORY_ORDER,
  orderInventory,
  resolveNumberedId,
};
