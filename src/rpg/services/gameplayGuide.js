const MAX_ENERGY = 15;

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
      detail: 'Alias diperlukan sebagai identitas karakter di seluruh dunia RPG.',
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
  if (state.maxHp > 0 && state.hp / state.maxHp < 0.4) {
    const hasPotion = Boolean(state.hasHealingItem);
    return {
      key: 'recover',
      title: 'Pulihkan HP sebelum melanjutkan',
      command: hasPotion ? '/inv' : '/shop',
      detail: `HP-mu ${state.hp}/${state.maxHp}. ` +
        (hasPotion
          ? 'Gunakan potion dari inventory; nomor item terlihat di /inv.'
          : `Beli Ramuan Kecil (15g) atau tunggu regen. Gold tersedia: ${state.gold}g.`),
      unlock: `Setelah HP minimal ${Math.ceil(state.maxHp * 0.4)}, tracker kembali ke objective campaign.`,
    };
  }
  if (state.energy < 2 && state.activeQuest?.objective?.type === 'dungeon_complete' &&
      state.level < (state.activeQuest.objective.recommendedLevel || 7)) {
    return {
      key: 'energy', title: 'Istirahat dan pulihkan energi', command: '/inv',
      detail: `Energi ${state.energy}/${MAX_ENERGY}. Hunt dan mine membutuhkan 2 energi; regen +1 setiap 3 menit.`,
      unlock: 'Saat energi minimal 2, lanjutkan hunt atau aktivitas profesi ringan.',
    };
  }
  const quest = state.activeQuest;
  const objective = quest?.objective;
  if (objective?.type === 'explore') {
    if (objective.targetId && state.currentRegionId !== objective.targetId) {
      if (state.level < (objective.targetRegionMinLevel || 1)) {
        return {
          key: 'prepare', title: `Persiapan menuju ${objective.label}`, command: '/hunt',
          detail: `Region tujuan membutuhkan Lv.${objective.targetRegionMinLevel}; level-mu Lv.${state.level}.`,
          unlock: `Saat level cukup, gunakan /travel ${objective.targetRegionNumber}.`,
        };
      }
      return {
        key: 'travel', title: `Perjalanan menuju ${objective.label}`,
        command: `/travel ${objective.targetRegionNumber}`,
        detail: `Kamu masih berada di ${state.regionName}. Pindah region agar objective eksplorasi dihitung.`,
        unlock: 'Setelah tiba, gunakan /explore.',
      };
    }
    return {
      key: 'explore', title: quest.title, command: '/explore',
      detail: `Kumpulkan petunjuk: ${objective.current}/${objective.target}. Masih perlu ${Math.max(0, objective.target - objective.current)} progres.`,
      unlock: state.nextQuestTitle
        ? `Berikutnya terbuka: ${state.nextQuestTitle}.`
        : 'Objective campaign berikutnya akan terbuka.',
    };
  }
  if (objective?.type === 'dungeon_complete') {
    const dungeonNumber = objective.dungeonNumber || 1;
    const recommendedLevel = objective.recommendedLevel || 7;
    if (state.level < recommendedLevel && !state.hasParty) {
      return {
        key: 'prepare', title: `Persiapan: ${quest.title}`, command: '/hunt',
        detail: `Target ${objective.label}. Kamu Lv.${state.level}; solo direkomendasikan Lv.${recommendedLevel}. Hunt untuk level, lalu forge/pasang gear lewat /gear. Ramuan HP bisa dibeli di /shop bila diperlukan.`,
        unlock: `Saat siap, gunakan /dungeon solo ${dungeonNumber}; duo memberi bonus loot setelah partner menyetujui undangan.`,
      };
    }
    return {
      key: 'dungeon', title: quest.title,
      command: state.hasParty
        ? `/dungeon duo ${dungeonNumber}`
        : `/dungeon solo ${dungeonNumber}`,
      detail: `Taklukkan target dungeon: ${objective.current}/${objective.target}. Siapkan gear aktif dan maksimal satu ramuan heal per room.`,
      unlock: state.nextQuestTitle
        ? `Berikutnya terbuka: ${state.nextQuestTitle}.`
        : 'Chapter selesai; aktivitas lanjutan dan endgame menjadi tujuan berikutnya.',
    };
  }
  if (objective?.type === 'hunt') {
    return {
      key: 'hunt', title: quest.title, command: '/hunt',
      detail: `Kalahkan monster target: ${objective.current}/${objective.target}.`,
      unlock: state.nextQuestTitle
        ? `Berikutnya terbuka: ${state.nextQuestTitle}.`
        : 'Chapter berikutnya akan terbuka setelah target perburuan selesai.',
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
      { title: 'Set Alias Karakter (/alias)', done: false },
      { title: 'Jelajah World Aldenmoor', done: false },
      { title: 'Berburu / Naik Level', done: false },
      { title: 'Selesaikan Campaign Chapter 1', done: false },
    ];
  }

  return [
    { title: 'Pilih Class & Buat Karakter', done: true },
    { title: 'Set Alias Karakter (/alias)', done: Boolean(state.hasAlias) },
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
        { cmd: '/gear', desc: 'Kelola, bandingkan, dan pasang equipment' },
        { cmd: '/skill', desc: 'Atur kombinasi loadout skill' },
        { cmd: '/inv', desc: 'Pakai potion & periksa item dropped' },
        { cmd: '/gear reforge [nomor]', desc: 'Acak ulang stat tambahan gear' },
        { cmd: '/gear socket [gear] [slot] [gem /inv]', desc: 'Pasang Gem HP & DEF pada gear' },
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
        { cmd: '/gear socket [gear] [slot] [gem /inv]', desc: 'Pasang Gem Magic ATK pada socket' },
        { cmd: '/gear reforge [nomor]', desc: 'Cari stat Magic & Crit Multiplier' },
      ],
    };
  }
  if (norm.includes('pencuri') || norm.includes('assassin') || norm.includes('rogue') || norm.includes('thief')) {
    return {
      className: '🗡️ Assassin (Crit/Control DPS)',
      statFocus: 'ATK, Crit Rate & Crit Multiplier',
      gearFocus: 'Senjata Fisik + Aksesori Crit (jaga HP karena DEF lebih rendah)',
      skillCombo: '1️⃣ Bom Asap saat telegraph ➔ 2️⃣ Backstab/Flurry untuk burst',
      commands: [
        { cmd: '/gear', desc: 'Pasang senjata dan aksesori ATK/Crit' },
        { cmd: '/skill', desc: 'Atur Backstab, Bom Asap, dan Flurry' },
        { cmd: '/inv', desc: 'Siapkan potion untuk dungeon panjang' },
        { cmd: '/gear reforge [nomor]', desc: 'Cari affix ATK dan Crit' },
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
        { cmd: '/gear reforge [nomor]', desc: 'Maksimalkan Crit Chance pada gear' },
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
      { cmd: '/gear reforge [nomor]', desc: 'Tingkatkan stat bonus' },
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
    explore_ethereal: 'Jelajahi Kepulauan Melayang Ethereal',
    hunt_astral: 'Kalahkan Monster Astral',
    explore_astral_nexus: 'Selidiki Titik Temu Dimensi Astral',
    clear_astral_citadel: 'Taklukkan Benteng Kristal Astral',
    explore_eclipse: 'Jelajahi Suaka Gerhana Abadi',
    clear_antimatter_spire: 'Taklukkan Menara Anti-Materi',
    explore_throne: 'Jelajahi Singgasana Ruang Hampa',
    clear_emperor_throne: 'Runtuhkan Kaisar Kosmik Xylarion',
  };
  return map[id] || (id || '').replace(/_/g, ' ');
}

function getSagaHeader(chapter) {
  const num = Number(chapter) || 1;
  if (num === 1) return '✨ <b>[SAGA I: PATCH 1.0 - THE MISTY FRONTIER] (Chapter 1)</b>';
  if (num === 2) return '✨ <b>[SAGA I: PATCH 1.1 - WEBS OF THE SILENT ABYSS] (Chapter 2)</b>';
  if (num === 3) return '✨ <b>[SAGA I: PATCH 1.2 - SHADOW DRAGON\'S WRATH] (Chapter 3 - Finale)</b>';
  if (num === 4) return '🌌 <b>[SAGA II: PATCH 2.0 - THE ASTRAL HORIZON] (Chapter 4)</b>';
  if (num === 5) return '🌌 <b>[SAGA II: PATCH 2.1 - COSMIC LEVIATHAN] (Chapter 5)</b>';
  if (num === 6) return '🌑 <b>[SAGA II: PATCH 2.2 - ANTIMATTER SHATTER] (Chapter 6)</b>';
  if (num === 7) return '👑 <b>[SAGA II: PATCH 2.3 - CELESTIAL EMPEROR] (Chapter 7 - Finale)</b>';
  return '✨ <b>[CHRONICLES OF ALDENMOOR - CAMPAIGN COMPLETE]</b>';
}

function getSagaFooter(chapter) {
  const num = Number(chapter) || 1;
  if (num === 1) {
    return '<i>📜 Saga Tracker: Jelajahi Pinggiran Aldenmoor dan taklukkan Reruntuhan Goblin berbekal penempaan gear (/gear reforge)!</i>';
  }
  if (num === 2) {
    return '<i>📜 Saga Tracker: Manfaatkan Pasar Gelap (/market) dan 7 Profesi Kuno untuk mengimbangi racun Ratu Laba-laba!</i>';
  }
  if (num === 3) {
    return '<i>📜 Saga Tracker: Bersatu dalam Aliansi Guild (/coop), tambang Obsidian Murni, dan redam amarah Naga Malakor di Kawah Magma!</i>';
  }
  if (num === 4) {
    return '<i>📜 Saga Tracker: Jelajahi Kepulauan Ethereal, buru pasukan Astral, dan siapkan Bahtera Guild menuju Void!</i>';
  }
  if (num === 5) {
    return '<i>📜 Saga Tracker: Temukan Nexus Astral lalu taklukkan Leviathan Kosmik di Benteng Kristal!</i>';
  }
  if (num === 6) {
    return '<i>📜 Saga Tracker: Baca telegraph boss dan rebut Menara Anti-Materi dari Archon Valtharor!</i>';
  }
  if (num === 7) {
    return '<i>📜 Saga Tracker: Bentuk duo, sempurnakan build, dan runtuhkan Kaisar Kosmik pada final Saga II!</i>';
  }
  return '<i>📜 Saga Tracker: Campaign aktif sudah selesai. Lanjutkan season, tower, raid, collection, dan mastery.</i>';
}

module.exports = {
  determineNextStep,
  getCompletedChecklist,
  getClassBuildAdvice,
  formatObjectiveLabel,
  getSagaHeader,
  getSagaFooter,
};
