function determineNextStep(state) {
  if (!state.hasCharacter) {
    return {
      key: 'character', title: 'Buat karakter', command: '/profile',
      detail: 'Pilih class dan selesaikan pembuatan alias.',
      unlock: 'World dan Chapter 1 akan terbuka.',
    };
  }
  if (!state.hasAlias) {
    return {
      key: 'alias', title: 'Lengkapi identitas karakter', command: '/alias NamaKarakter',
      detail: 'Alias diperlukan sebagai identitas anonim di seluruh dunia RPG.',
      unlock: 'Setelah alias tersimpan, mulai Chapter 1 melalui /world.',
    };
  }
  if (state.activeDungeon) {
    return {
      key: 'resume', title: `Lanjutkan ${state.activeDungeon.name}`, command: '/dungeon',
      detail: `Checkpoint berada di ${state.activeDungeon.roomName}. Progress room tidak perlu diulang.`,
      unlock: 'Selesaikan boss untuk memperbarui objective campaign.',
    };
  }
  const quest = state.activeQuest;
  const objective = quest?.objective;
  if (objective?.type === 'explore') {
    return {
      key: 'explore', title: quest.title, command: '/explore',
      detail: `Kumpulkan petunjuk: ${objective.current}/${objective.target}. Masih perlu ${Math.max(0, objective.target - objective.current)} progres.`,
      unlock: state.nextQuestTitle
        ? `Berikutnya terbuka: ${state.nextQuestTitle}.`
        : 'Objective campaign berikutnya akan terbuka.',
    };
  }
  if (objective?.type === 'dungeon_complete') {
    if (state.level < 7 && !state.hasParty) {
      return {
        key: 'prepare', title: `Persiapan: ${quest.title}`, command: '/hunt',
        detail: `Objective berikutnya adalah dungeon. Kamu Lv.${state.level}; solo direkomendasikan Lv.7. Naikkan level/gear atau bentuk duo.`,
        unlock: 'Saat siap, gunakan /dungeon solo 1 atau buat party untuk /dungeon duo 1.',
      };
    }
    return {
      key: 'dungeon', title: quest.title,
      command: state.hasParty ? '/dungeon duo 1' : '/dungeon solo 1',
      detail: `Taklukkan target dungeon: ${objective.current}/${objective.target}.`,
      unlock: state.nextQuestTitle
        ? `Berikutnya terbuka: ${state.nextQuestTitle}.`
        : 'Chapter selesai; aktivitas lanjutan dan endgame menjadi tujuan berikutnya.',
    };
  }
  if (quest && objective) {
    return {
      key: 'campaign', title: quest.title, command: '/campaign',
      detail: `Objective ${objective.label}: ${objective.current}/${objective.target}.`,
      unlock: state.nextQuestTitle ? `Berikutnya: ${state.nextQuestTitle}.` : 'Lanjutkan chapter berikutnya.',
    };
  }
  return {
    key: 'endgame', title: 'Campaign tersedia sudah selesai', command: '/season',
    detail: 'Lanjutkan perkembangan permanen melalui tower, raid, achievement, collection, dan equipment.',
    unlock: 'Region atau chapter baru akan tampil otomatis ketika content berikutnya dirilis.',
  };
}

module.exports = { determineNextStep };
