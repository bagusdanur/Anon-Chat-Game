function determineNextStep(state) {
  if (!state.hasCharacter) {
    return { key: 'character', title: 'Buat karakter', command: '/profile', detail: 'Pilih class lalu buat alias anonim.' };
  }
  if (!state.hasAlias) {
    return { key: 'alias', title: 'Lengkapi alias', command: '/alias NamaKarakter', detail: 'Alias adalah identitasmu di party, guild, dan ranking.' };
  }
  if (!state.hasSkill) {
    return { key: 'skill', title: 'Pasang build awal', command: '/skill', detail: 'Pelajari skill bernomor lalu isi loadout.' };
  }
  if (state.explorationPoints < 3) {
    return { key: 'explore', title: 'Kumpulkan petunjuk', command: '/explore', detail: `Butuh ${3 - state.explorationPoints} poin eksplorasi lagi.` };
  }
  if (!state.hasDungeonClear && state.level < 7 && !state.hasParty) {
    return { key: 'prepare', title: 'Persiapkan dungeon', command: '/hunt', detail: 'Naikkan level menuju 7, perbaiki gear, atau buat duo melalui /party.' };
  }
  if (!state.hasDungeonClear) {
    return {
      key: 'dungeon',
      title: state.hasParty ? 'Taklukkan dungeon duo' : 'Taklukkan dungeon pertama',
      command: state.hasParty ? '/dungeon duo 1' : '/dungeon solo 1',
      detail: state.hasParty ? 'Bergantian aksi dan gunakan Combo 3/3.' : 'Solo direkomendasikan mulai level 7.',
    };
  }
  if (!state.hasParty) {
    return { key: 'coop', title: 'Coba anonymous co-op', command: '/coop', detail: 'Buat party dengan partner chat untuk bounty, campaign, dungeon, dan raid.' };
  }
  return { key: 'endgame', title: 'Masuk progres lanjutan', command: '/season', detail: 'Lanjutkan tower, weekly raid, collection, achievement, dan ranking.' };
}

module.exports = { determineNextStep };
