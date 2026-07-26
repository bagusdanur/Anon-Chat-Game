/**
 * 🎮 SIMULASI PLAYTHROUGH: PETUALANGAN AKUN BARU [🎭 MIRACLE] (Pasca-Reset)
 * Membawa karakter pengguna "🎭 Miracle" dari titik 0 (Lv. 1, 0 Gold) 
 * berjuang dari awal Chapter 1 hingga menjadi Dewatanya Saga II (Level 60 - Patch 2.3)!
 */

const fs = require('fs');
const path = require('path');
require('../data/patch_loader');

async function runMiracleJourney() {
  console.log(`====================================================================================`);
  console.log(`🌱 MEMULAI SIMULASI DARI TITIK ZERO (LV. 1, 0 GOLD): [🎭 Miracle · ⚔️ Ksatria]`);
  console.log(`====================================================================================`);

  let miracle = {
    name: '🎭 Miracle',
    class: '⚔️ Ksatria',
    level: 1,
    hp: 100,
    maxHp: 100,
    atk: 12.0,
    def: 10.0,
    gold: 0,
    weapon: '⚪ 🗡️ Pedang Kayu Pelatihan',
    armor: '⚪ 👕 Pakaian Rakyat Biasa',
    accessory: 'Tidak ada',
    skills: ['1️⃣ Guard Stance ( Dasar )'],
    profession: { gather: 1, mine: 1, fish: 1 },
    inventory: ['ramuan_kecil (x1)'],
    chapter: 1
  };

  function printStatus(stageTitle) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📌 STATUS UPDATE: ${stageTitle}`);
    console.log(`${miracle.name} · ${miracle.class} Lv.${miracle.level} · 💰 ${miracle.gold.toLocaleString('id-ID')}g`);
    console.log(`❤️ HP ██████████ ${miracle.hp}/${miracle.maxHp} | ⚔️ ATK ${miracle.atk.toFixed(1)} | 🛡️ DEF ${miracle.def.toFixed(1)}`);
    console.log(`🗡️ Weapon: ${miracle.weapon} | 🛡️ Armor: ${miracle.armor}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  }

  printStatus("PROFIL AWAL (Baru Terdaftar Pasca-Reset)");

  // =========================================================================
  // CHAPTER 1: PATCH 1.0 - THE MISTY FRONTIER (Lv. 1 -> 7)
  // =========================================================================
  console.log(`🌲 [CHAPTER 1 · PATCH 1.0]: Kabut di Perbatasan & Reruntuhan Goblin.`);
  console.log(`👉 Miracle mengambil langkah perdana: /explore Pinggiran Aldenmoor!`);
  console.log(`   ⚔️ Berhadapan dengan Goblin Pengintai & Kelabang Kayu (/hunt) -> Menang pertama! (+80 XP, +45 Gold)`);
  console.log(`   🌿 Belajar memetik Tanaman Obat Asisten (/gather) & memancing ikan sungai (/fish).`);
  console.log(`   💎 Menambang Besi Rongsok di perbukitan (/mine) untuk bekal modal reforge perdana.`);

  miracle.level = 7;
  miracle.maxHp = 140;
  miracle.hp = 140;
  miracle.atk = 22.5;
  miracle.def = 22.0;
  miracle.gold = 409;
  miracle.weapon = '🟠 🗡️ Pedang Goblin Bertuah';
  miracle.armor = '🟣 🧥 Jubah Terkutuk';
  miracle.chapter = 2;

  console.log(`🏰 Miracle mendobrak Solo Dungeon perdana: [Reruntuhan Goblin] (5 Ruangan)!`);
  console.log(`   👺 BOSS BATTLE: Kepala Goblin Kabut -> Kalah telak oleh pukulan keras Miracle!`);
  console.log(`   🎁 LOOT DROP: Mendapatkan Pedang Goblin Bertuah dan 409 Gold!`);

  printStatus("SELESAI CHAPTER 1 (Menembus Reruntuhan Goblin)");

  // =========================================================================
  // CHAPTER 2: PATCH 1.1 - WEBS OF THE SILENT ABYSS (Lv. 7 -> 15)
  // =========================================================================
  console.log(`🕸️ [CHAPTER 2 · PATCH 1.1]: Lembah Kelam & Sarang Ratu Laba-laba.`);
  console.log(`👉 Miracle merekrut partner Duo Co-Op perdana (/coop) dan menjelajah Lembah Kelam (/explore 6x).`);
  console.log(`   ⛏️ Menambang Bijih Besi Perak Murni (/mine) & menjual kelebihan herb di Pasar Escrow (/market).`);
  
  miracle.level = 15;
  miracle.maxHp = 210;
  miracle.hp = 210;
  miracle.atk = 48.0;
  miracle.def = 42.0;
  miracle.gold += 750;
  miracle.weapon = '🔴 🗡️ Pedang Baja Perak Bertuah (+15 ATK)';
  miracle.chapter = 3;

  console.log(`🏰 Menakluk Lembah Kelabing! Miracle dan partner Duo membantai Ratu Laba-Laba Kelabing! (+1.200 XP, +500 Gold)`);
  miracle.gold += 500;

  printStatus("SELESAI CHAPTER 2 (Pembantai Lembah Kelam)");

  // =========================================================================
  // CHAPTER 3: PATCH 1.2 - SHADOW DRAGON'S WRATH (Lv. 15 -> 25) [SAGA I FINALE]
  // =========================================================================
  console.log(`🐉 [CHAPTER 3 · PATCH 1.2]: Benteng Gunung Berapi & Naga Bayangan Malakor!`);
  console.log(`👉 Miracle mendirikan Aliansi Guild kuat dan menjelajah Puncak Gunung Berapi!`);
  console.log(`   🎣 Memancing Sisik Naga Perak di danau magma (/fish) dan menempa set Obsidian di /reforge.`);

  miracle.level = 25;
  miracle.maxHp = 350;
  miracle.hp = 350;
  miracle.atk = 92.0;
  miracle.def = 80.0;
  miracle.gold += 1800;
  miracle.armor = '🔴 🛡️ Zirah Sisik Naga Malakor (+35 DEF)';
  miracle.weapon = '👑 🗡️ Pedang Naga Obsidian Purba (+50 ATK)';
  miracle.chapter = 4;

  console.log(`🏰 Ekspedisi 20-Ruangan [Benteng Gunung Berapi]! Sinergi tim membakar habis pertahanan Naga Bayangan Malakor!`);
  miracle.gold += 1500;

  printStatus("SELESAI SAGA I FINALE (Pahlawan Pembebas Aldenmoor)");

  // =========================================================================
  // CHAPTER 4 & 5: PATCH 2.0 & 2.1 - ETHEREAL ISLES & ASTRAL CITADEL (Lv. 25 -> 40)
  // =========================================================================
  console.log(`🛸 [SAGA II: THE ASTRAL HORIZON · PATCH 2.0 & 2.1]: Kepulauan Melayang & Benteng Kristal Astral!`);
  console.log(`👉 Miracle meluncurkan Bahtera Guild menembus atmosfer kosmik luar angkasa!`);
  console.log(`   ⚔️ Menerkam Golem Kristal Kosmik (Patch 2.0) & memborong Gem Astral di /market!`);
  console.log(`   🐋 Mengeksekusi Dungeon 15-Ruangan [Benteng Kristal Astral], menumpas sang Leviathan Kosmik!`);

  miracle.level = 40;
  miracle.maxHp = 620;
  miracle.hp = 620;
  miracle.atk = 155.0;
  miracle.def = 140.0;
  miracle.gold += 3500;
  miracle.weapon = '🌌 🗡️ Pedang Starlight Kosmik (+85 ATK, +20% Crit)';
  miracle.chapter = 6;

  printStatus("SELESAI PATCH 2.1 (Panglima Armada Bahtera)");

  // =========================================================================
  // CHAPTER 6: PATCH 2.2 - ECLIPSE SANCTUARY & ANTIMATTER SPIRE (Lv. 40 -> 50)
  // =========================================================================
  console.log(`🌑 [CHAPTER 6 · PATCH 2.2]: Suaka Gerhana Abadi & Menara Anti-Materi!`);
  console.log(`👉 Mendarat di daratan gerhana remang, menambang Air Mata Gerhana (/mine).`);
  console.log(`   🏰 Terobos elevator laser di Menara Anti-Materi Prisma! Bertahan dari sabetan sayap Archon Malaikat Void Valtharor dan merebut kemenangannya!`);

  miracle.level = 50;
  miracle.maxHp = 880;
  miracle.hp = 880;
  miracle.atk = 225.0;
  miracle.def = 205.0;
  miracle.gold += 6000;
  miracle.armor = '🌑 🛡️ Zirah Sayap Void Valtharor (+80 DEF)';
  miracle.weapon = '⚡ 🗡️ Pedang Halilintar Anti-Materi (+140 ATK)';
  miracle.chapter = 7;

  printStatus("SELESAI PATCH 2.2 (Runtuhnya Menara Anti-Materi)");

  // =========================================================================
  // CHAPTER 7: PATCH 2.3 - EMPEROR XYLARION'S THRONE (Lv. 50 -> 60+) [GRAND FINALE]
  // =========================================================================
  console.log(`👑 [CHAPTER 7 · PATCH 2.3 - SAGA II GRAND FINALE]: Singgahan Ruang Hampa & Istana Tahta Kaisar!`);
  console.log(`👉 Miracle menyatukan seluruh pasukan Aliansi Guild dan menyusup ke Black Hole statis!`);
  console.log(`   🛡️ Menyongsong 20 Ruangan Istana Tahta Kaisar, menembus Koridor Cermin dan Tangga Mahkota!`);
  console.log(`   💥 FINAL BATTLE melawan Kaisar Kosmik Xylarion (HP: 25.000)! Serangan ko-operatif Miracle menghancurkan tongkat mahkota Xylarion dan menyeimbangkan tata surya!`);

  miracle.level = 60;
  miracle.maxHp = 1350;
  miracle.hp = 1350;
  miracle.atk = 345.0;
  miracle.def = 305.0;
  miracle.gold += 18500;
  miracle.weapon = '🌟 🗡️ Pedang Mahakarya Kaisar Supernova (+220 ATK, 25% Crit)';
  miracle.accessory = '👑 💍 Mahkota Inti Galaksi Xylarion (+60 All Stats)';

  console.log(`\n🎉 ======================================================================= 🎉`);
  console.log(`   👑 KETIKA XYLARION GUGUR, IA MEMBISIKKAN KUTUKAN KELAM:`);
  console.log(`   💬 "Kematianku... melepas Gembok Inti Bumi Aldenmoor... Dengarkan rintihan Raksasa dari Forgotten Realm..."`);
  console.log(`   🌪️ GERBANG PORTAL BAWAH TANAH TERBUKA MENUJU SAGA III!`);
  console.log(`🎉 ======================================================================= 🎉\n`);

  console.log(`🏆 [PROFIL PAMUNGKAS SANG JAWARA KOSMIK PASCA-RESET] 🏆`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🎭 Miracle · ⚔️ Ksatria Lv.60 · 💰 ${miracle.gold.toLocaleString('id-ID')}g`);
  console.log(`👑 Gelar: Sang Jawara Kosmik & Dewatanya Aldenmoor`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`❤️ HP ██████████ ${miracle.hp}/${miracle.maxHp}`);
  console.log(`✨ XP ██████████ SAGA II TAMAT / MAX LEVEL CAP`);
  console.log(`⚡️ EN ██████████ 10/10`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 STATS & STATUS`);
  console.log(`⚔️ ATK 345,00  (+220 eq)   🛡️ DEF 305,00  (+180 eq)`);
  console.log(`💥 Crit 25% × 200%   🎯 ⚔️ Physical Starlight`);
  console.log(`🏰 Dungeon: ✅ Seluruh 7 Dungeon Tuntas Tas Tas!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🗡️ EQUIPMENT & SKILLS`);
  console.log(`⚔️ Weapon   : 🌟 🗡️ Pedang Mahakarya Kaisar Supernova`);
  console.log(`🛡️ Armor    : 🌑 🛡️ Zirah Sayap Void Valtharor`);
  console.log(`💍 Accessory: 👑 💍 Mahkota Inti Galaksi Xylarion`);
  console.log(`🔥 Skill    : 1️⃣ Guard Stance · 2️⃣ Tebasan Supernova`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🚀 STATUS SELANJUTNYA: Pesta Kejayaan sembari bersiap untuk SAGA III: UNDERWORLD OF THE FORGOTTEN REALM (Patch 3.0)!`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

runMiracleJourney().catch(console.error);
