const { simulateEconomy } = require('../src/rpg/services/economySimulation');

let state = 0x5f3759df;
function seededRandom() {
  state = (state * 1664525 + 1013904223) >>> 0;
  return state / 0x100000000;
}

const result = simulateEconomy({
  playerCount: Number(process.argv[2]) || 5000,
  days: Number(process.argv[3]) || 70,
  random: seededRandom,
});

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (result.negativeBalances > 0) process.exitCode = 1;
