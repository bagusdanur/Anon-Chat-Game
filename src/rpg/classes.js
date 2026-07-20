// CATATAN: File ini adalah DEAD CODE / LEGACY — tidak di-require oleh siapapun.
// Definisi class RPG yang AKTIF dipakai ada di src/rpg/db_rpg.js (CLASS_DEFS).
// Jangan hapus dulu kalau ingin dijadikan referensi desain awal, tapi jangan edit.

  ksatria: {
    name: 'Ksatria',
    icon: '⚔️',
    hp: 32,
    maxHp: 32,
    atkMin: 6,
    atkMax: 9,
    def: 3,
    spd: 2,
    skillName: 'Tebasan Kilat',
    skillDesc: 'Serang 2x dalam 1 turn (cd 3)',
    skillCooldownMax: 3
  },
  penyihir: {
    name: 'Penyihir',
    icon: '🔥',
    hp: 20,
    maxHp: 20,
    atkMin: 4,
    atkMax: 12,
    def: 1,
    spd: 3,
    skillName: 'Bola Api',
    skillDesc: 'Damage tetap 14, abaikan DEF musuh (cd 3)',
    skillCooldownMax: 3
  },
  pencuri: {
    name: 'Pencuri',
    icon: '🗡️',
    hp: 24,
    maxHp: 24,
    atkMin: 5,
    atkMax: 8,
    def: 2,
    spd: 5,
    skillName: 'Serangan Bayangan',
    skillDesc: 'Guaranteed crit (x2 dmg) (cd 3)',
    skillCooldownMax: 3
  }
};

function createPlayerState(chatId, classKey) {
  const cls = classes[classKey];
  return {
    chatId: chatId.toString(),
    class: classKey,
    hp: cls.hp,
    maxHp: cls.maxHp,
    atkMin: cls.atkMin,
    atkMax: cls.atkMax,
    def: cls.def,
    spd: cls.spd,
    skillCooldown: 0,
    alive: true,
    buffs: {}
  };
}

module.exports = { classes, createPlayerState };
