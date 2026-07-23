function simulateEconomy(options = {}) {
  const playerCount = options.playerCount || 5000;
  const days = options.days || 70;
  const random = options.random || Math.random;
  const players = Array.from({ length: playerCount }, () => ({
    gold: 250,
    materials: 0,
    level: 1,
  }));
  let sources = playerCount * 250;
  let sinks = 0;
  let itemsCreated = 0;
  let itemsDestroyed = 0;

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
      }
      if (random() < 0.6) {
        const tax = Math.min(player.gold, 15 + Math.floor(random() * 51));
        player.gold -= tax;
        sinks += tax;
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
    itemsCreated, itemsDestroyed, negativeBalances,
  };
}

module.exports = { simulateEconomy };
