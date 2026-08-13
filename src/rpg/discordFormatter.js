function profile(user) {
  if (!user) return 'Belum ada karakter. Gunakan `/profile` untuk membuat karakter.';
  return [`⚔️ **${user.class_name || 'ksatria'} — Lv.${user.level}**`, `❤️ HP: ${user.hp}/${user.max_hp}   ⚡ Energy: ${user.energy_current}`, `⚔️ ATK: ${user.atk}   🛡️ DEF: ${user.def}`, `✨ XP: ${user.xp}   💰 Gold: ${user.gold}`].join('\n');
}
module.exports = { profile };
