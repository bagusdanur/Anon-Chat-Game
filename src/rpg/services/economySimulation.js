function simulateEconomy(options = {}) {
  const playerCount = options.playerCount || 5000;
  const days = options.days || 70;
  const random = options.random || Math.random;
  const players = Array.from({ length: playerCount }, () => ({
    gold: 250,
    materials: 0,
    level: 1,
    potions: 0,
    reforgeCount: 0,
  }));
  let sources = playerCount * 250;
  let sinks = 0;
  let itemsCreated = 0;
  let itemsDestroyed = 0;
  const sinkBreakdown = { crafting: 0, upgrade: 0, reforge: 0, shop: 0, marketTax: 0, travel: 0, guildProject: 0 };
  let potionsUsed = 0;

  for (let day = 0; day < days; day++) {
    for (const player of players) {
      const active = random() < 0.62;
      if (!active) continue;
      const earned = 35 + Math.floor(random() * 70) + player.level * 2;
      player.gold += earned;
      sources += earned;
      const gathered = 1 + Math.floor(random() * 4);
      player.materials += gathered;
      itemsCreated += gathered;

      if (player.materials >= 4 && random() < 0.48) {
        const used = 2 + Math.floor(random() * 3);
        const actual = Math.min(used, player.materials);
        player.materials -= actual;
        itemsDestroyed += actual;
        const craftCost = Math.min(player.gold, 15 + player.level * 2);
        player.gold -= craftCost;
        sinks += craftCost;
        sinkBreakdown.crafting += craftCost;
      }
      // Pembelian ramuan dan perjalanan adalah sink kecil yang rutin. Keduanya
      // sengaja dibatasi agar pemain baru tidak kehabisan gold sebelum progres.
      if (random() < 0.24 && player.gold > 45) {
        const shopCost = Math.min(player.gold, 18 + Math.floor(random() * 18));
        player.gold -= shopCost;
        player.potions += 1;
        sinks += shopCost;
        sinkBreakdown.shop += shopCost;
        itemsCreated += 1;
      }
      if (player.potions > 0 && random() < 0.14) {
        player.potions -= 1;
        potionsUsed += 1;
        itemsDestroyed += 1;
      }
      if (random() < 0.18 && player.gold > 35) {
        const travelCost = Math.min(player.gold, 10 + Math.floor(random() * 16));
        player.gold -= travelCost;
        sinks += travelCost;
        sinkBreakdown.travel += travelCost;
      }
      // Upgrade dipicu setelah bahan cukup. Biayanya meningkat seiring level,
      // sehingga endgame tetap punya gold sink tanpa memaksa pemain baru.
      if (player.materials >= 8 && random() < 0.22 && player.gold > 120) {
        const used = Math.min(4, player.materials);
        const upgradeCost = Math.min(player.gold, 55 + player.level * 5);
        player.materials -= used;
        player.gold -= upgradeCost;
        itemsDestroyed += used;
        sinks += upgradeCost;
        sinkBreakdown.upgrade += upgradeCost;
      }
      // Reforge adalah sink endgame opsional: hanya tersedia sesudah pemain
      // punya cadangan gold dan material. Ini memodelkan pemain yang mengejar
      // affix build, bukan biaya wajib untuk menamatkan campaign.
      if (player.materials >= 5 && random() < 0.28 && player.gold > 180) {
        const used = Math.min(3, player.materials);
        const repeatSurcharge = Math.max(0, player.reforgeCount - 2) * 90;
        const reforgeCost = Math.min(player.gold, 120 + player.level * 11 + repeatSurcharge);
        player.materials -= used;
        player.gold -= reforgeCost;
        itemsDestroyed += used;
        sinks += reforgeCost;
        sinkBreakdown.reforge += reforgeCost;
        player.reforgeCount++;
      }
      if (random() < 0.42 && player.gold > 40) {
        const tax = Math.min(player.gold, 10 + Math.floor(random() * 31));
        player.gold -= tax;
        sinks += tax;
        sinkBreakdown.marketTax += tax;
      }
      if (player.level >= 20 && random() < 0.12 && player.gold > 100) {
        const contribution = Math.min(player.gold, 35 + player.level * 3);
        player.gold -= contribution;
        sinks += contribution;
        sinkBreakdown.guildProject += contribution;
      }
      if (random() < 0.08) player.level = Math.min(60, player.level + 1);
    }
  }

  const totalGold = players.reduce((sum, player) => sum + player.gold, 0);
  const negativeBalances = players.filter(player => player.gold < 0 || player.materials < 0).length;
  const sorted = players.map(player => player.gold).sort((a, b) => a - b);
  const percentile = value => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * value))];
  return {
    playerCount, days, sources, sinks, totalGold,
    sourceSinkRatio: sinks ? Number((sources / sinks).toFixed(3)) : null,
    goldPerPlayer: Math.round(totalGold / playerCount),
    p50Gold: percentile(0.5),
    p90Gold: percentile(0.9),
    itemsCreated, itemsDestroyed, potionsUsed, sinkBreakdown, negativeBalances,
  };
}

module.exports = { simulateEconomy };
