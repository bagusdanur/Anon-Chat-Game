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

function getCompletedChecklist(state) {
  if (!state || !state.hasCharacter) {
    return [
      { title: 'Pilih Class & Buat Karakter', done: false },
      { title: 'Set Alias Anonim (/alias)', done: false },
      { title: 'Jelajah World Aldenmoor', done: false },
      { title: 'Berburu / Naik Level', done: false },
      { title: 'Selesaikan Campaign Chapter 1', done: false },
    ];
  }

  return [
    { title: 'Pilih Class & Buat Karakter', done: true },
    { title: 'Set Alias Anonim (/alias)', done: Boolean(state.hasAlias) },
    { title: 'Jelajah World Aldenmoor (/explore)', done: Boolean(state.hasAlias && (state.explorationPoints > 0 || state.level > 1 || state.chapter > 1)) },
    { title: 'Berburu Monster (/hunt)', done: Boolean(state.level >= 2) },
    { title: 'Selesaikan Campaign Chapter 1', done: Boolean(state.isChapter1Completed || state.chapter > 1) },
    { title: 'Taklukkan Solo/Duo Dungeon', done: Boolean(state.level >= 7 || state.chapter > 1 || state.isChapter1Completed) },
    { title: 'Bentuk Party / Co-Op (/coop)', done: Boolean(state.hasParty) },
  ];
}

function getClassBuildAdvice(className) {
  const norm = String(className || '').toLowerCase();
  if (norm.includes('ksatria') || norm.includes('knight') || norm.includes('warrior')) {
    return {
      className: '⚔️ Ksatria (Warrior/Tank)',
      statFocus: 'ATK, DEF & HP',
      gearFocus: 'Pedang/Senjata Fisik + Heavy Armor (Cari Bonus ATK% & DEF)',
      skillCombo: '1️⃣ Guard Stance (Def) ➔ 2️⃣ Tebasan Berat (Burst)',
      commands: [
        { cmd: '/gear', desc: 'Kelola & pasang equipment V1/V2' },
        { cmd: '/skill', desc: 'Atur kombinasi loadout skill' },
        { cmd: '/inv', desc: 'Pakai potion & periksa item dropped' },
        { cmd: '/reforge', desc: 'Acak ulang stat tambahan gear V2' },
        { cmd: '/socket', desc: 'Pasang Gem HP & DEF pada gear' },
      ],
    };
  }
  if (norm.includes('penyihir') || norm.includes('mage') || norm.includes('wizard')) {
    return {
      className: '🔮 Penyihir (Magic Burst)',
      statFocus: 'Magic ATK & Crit Rate',
      gearFocus: 'Tongkat Sihir + Jubah (Cari Bonus Magic ATK & Crit Rate)',
      skillCombo: '1️⃣ Mana Shield ➔ 2️⃣ Serangan Sihir Elemen',
      commands: [
        { cmd: '/gear', desc: 'Pasang Tongkat & Jubah Magic' },
        { cmd: '/skill', desc: 'Atur loadout skill sihir' },
        { cmd: '/socket', desc: 'Pasang Gem Magic ATK pada socket' },
        { cmd: '/reforge', desc: 'Cari stat Magic & Crit Multiplier' },
      ],
    };
  }
  if (norm.includes('pemanah') || norm.includes('ranger') || norm.includes('archer')) {
    return {
      className: '🏹 Pemanah (Ranged Crit DPS)',
      statFocus: 'ATK, Crit Rate & Crit Multiplier',
      gearFocus: 'Busur Panah + Zirah Ringan (Prioritas Crit Rate)',
      skillCombo: '1️⃣ Tembakan Ganda ➔ 2️⃣ Panah Beracun',
      commands: [
        { cmd: '/gear', desc: 'Pasang Busur & Aksesori Crit' },
        { cmd: '/skill', desc: 'Set loadout tembakan crit' },
        { cmd: '/reforge', desc: 'Maksimalkan Crit Chance pada gear' },
      ],
    };
  }
  return {
    className: '🗡️ Petualang / All-Rounder',
    statFocus: 'ATK, DEF & Crit Rate Balance',
    gearFocus: 'Senjata Utama + Armor Terbaik (Utamakan Skor Item Power IP)',
    skillCombo: '1️⃣ Buff Defense / Utilitas ➔ 2️⃣ Skill Serangan Utama',
    commands: [
      { cmd: '/gear', desc: 'Kelola equipment' },
      { cmd: '/skill', desc: 'Atur slot skill' },
      { cmd: '/inv', desc: 'Kelola tas & potion' },
      { cmd: '/reforge', desc: 'Tingkatkan stat bonus' },
    ],
  };
}

function formatObjectiveLabel(id) {
  const map = {
    explore_outskirts: 'Jelajahi Pinggiran Aldenmoor',
    clear_ruins: 'Taklukkan Reruntuhan Goblin',
    explore_valley: 'Jelajahi Lembah Sutra Beracun',
    clear_spider_nest: 'Taklukkan Sarang Ratu Laba-laba',
    explore_volcano: 'Jelajahi Gunung Berapi Bayangan',
    clear_volcano_fortress: 'Taklukkan Benteng Vulkanik Kuil Bayangan',
  };
  return map[id] || (id || '').replace(/_/g, ' ');
}

function getSagaHeader(chapter) {
  const num = Number(chapter) || 1;
  if (num === 1) return '✨ <b>[SAGA I: PATCH 1.0 - THE MISTY FRONTIER] (Chapter 1)</b>';
  if (num === 2) return '✨ <b>[SAGA I: PATCH 1.1 - WEBS OF THE SILENT ABYSS] (Chapter 2)</b>';
  if (num === 3) return '✨ <b>[SAGA I: PATCH 1.2 - SHADOW DRAGON\'S WRATH] (Chapter 3 - Finale)</b>';
  return '✨ <b>[SAGA I: THE ALDENMOOR CRISIS - COMPLETE FINALE]</b>';
}

function getSagaFooter(chapter) {
  const num = Number(chapter) || 1;
  if (num === 1) {
    return '<i>📜 Saga Tracker: Jelajahi Pinggiran Aldenmoor dan taklukkan Reruntuhan Goblin berbekal penempaan gear (/reforge)!</i>';
  }
  if (num === 2) {
    return '<i>📜 Saga Tracker: Manfaatkan Pasar Gelap (/market) dan 7 Profesi Kuno untuk mengimbangi racun Ratu Laba-laba!</i>';
  }
  if (num === 3) {
    return '<i>📜 Saga Tracker: Bersatu dalam Aliansi Guild (/coop), tambang Obsidian Murni, dan redam amarah Naga Malakor di Kawah Magma!</i>';
  }
  return '<i>📜 Saga Tracker: Seluruh tantangan Saga I telah lunas ditaklukkan! Bersiap menyambut Invasi Astral pada Saga II!</i>';
}

module.exports = {
  determineNextStep,
  getCompletedChecklist,
  getClassBuildAdvice,
  formatObjectiveLabel,
  getSagaHeader,
  getSagaFooter,
};


