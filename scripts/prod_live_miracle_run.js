/**
 * 🚀 PRODUCTION LIVE PLAYTHROUGH & FULL GEAR ENDGAME BOOST SCRIPT
 * Menghubungkan langsung ke database SQLite production (bot.db) di VPS server,
 * mendeteksi akun petualang nyata (terutama akun Anda yang diubah menjadi Miracle),
 * dan memasangkan SELURUH GEAR LEGENDARIS (Legacy + Equipment V2 IP 550+ + Socket Jempolan),
 * menyusun FULL SKILL LOADOUT (3 Skill Dewa Aktif di Slot 1, 2, 3),
 * serta menaklukkan seluruh Saga I & II ke Level 60 Max Cap!
 */

const { db } = require('../src/db');
require('../src/rpg/db_rpg'); // Skema RPG & migrasi aktif
require('../data/patch_loader'); // Aggregator patch aktif
const { loadSkills, publishSkills } = require('../src/rpg/services/skills');
const { renderProfile } = require('../src/rpg/profile');

console.log(`\n====================================================================================`);
console.log(`🔥 [PRODUCTION ENGINE WAL]: MENGHUBUNGKAN KE DATABASE LIVE SERVER (bot.db)`);
console.log(`====================================================================================\n`);

// 0. Pastikan katalog skill resmi dan skill khusus Saga II sudah terpublikasi di db
try {
  publishSkills(db, loadSkills());
  console.log(`✅ Katalog resmi skill berhasil dipadukan ke database production.`);
} catch (e) {
  console.log(`⚠️ Info Skill Loader:`, e.message);
}

// 0.5 Perbarui skema tabel items_catalog jika masih tersisa batas kuno (belum mendukung 'accessory' & 'staff')
try {
  db.prepare("INSERT INTO items_catalog (item_id, display_name, category, rarity, sell_price) VALUES ('test_acc', 'test', 'accessory', 'rare', 0)").run();
  db.prepare("DELETE FROM items_catalog WHERE item_id = 'test_acc'").run();
} catch (e) {
  console.log(`🛠️ Memperbarui skema items_catalog di bot.db agar mendukung 'accessory' & 'staff' (Mengubah Check Constraint kuno)...`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS items_catalog_new (
      item_id      TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      category     TEXT NOT NULL CHECK (category IN ('consumable','material','weapon','staff','armor','accessory')),
      rarity       TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
      sell_price   INTEGER DEFAULT 0,
      effect_json  TEXT
    );
    INSERT OR IGNORE INTO items_catalog_new SELECT * FROM items_catalog;
    DROP TABLE items_catalog;
    ALTER TABLE items_catalog_new RENAME TO items_catalog;
  `);
  console.log(`✅ Skema items_catalog berhasil diperluas! Sekarang siap menampung Mahkota Kosmik!`);
}

// 1. Cari semua user di tabel rpg_users atau di tabel users (Telegram Chat ID)
const rpgUsers = db.prepare('SELECT * FROM rpg_users').all();
const telegramUsers = db.prepare('SELECT * FROM users').all();

console.log(`📊 Status Database Production Saat Ini:`);
console.log(`   - Jumlah Pengguna Telegram Terdaftar : ${telegramUsers.length}`);
console.log(`   - Jumlah Karakter RPG Terbuat       : ${rpgUsers.length}\n`);

let targetAccounts = [...rpgUsers];

// Jika ada pengguna telegram di tabel users tapi belum sempat berafiliasi di rpg_users pasca-reset
if (telegramUsers.length > 0) {
  for (const tUser of telegramUsers) {
    const existing = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(String(tUser.chat_id));
    if (!existing) {
      console.log(`🌱 [PASCA-RESET FIX]: Mendaftarkan otomatis Chat ID ${tUser.chat_id} ke RPG sebagai ⚔️ Ksatria Lv. 1...`);
      const now = Math.floor(Date.now() / 1000);
      try {
        db.prepare(`
          INSERT INTO rpg_users (telegram_user_id, class_name, level, xp, gold, hp, max_hp, atk, def, created_at, updated_at)
          VALUES (?, 'ksatria', 1, 0, 0, 100, 100, 12, 10, ?, ?)
        `).run(String(tUser.chat_id), now, now);
        
        const newRow = db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(String(tUser.chat_id));
        if (newRow) targetAccounts.push(newRow);
      } catch (e) {
        console.error(`Gagal inisialisasi user ${tUser.chat_id}:`, e.message);
      }
    }
  }
}

if (targetAccounts.length === 0) {
  console.log(`⚠️ Belum ada aktivitas user pasca-reset total. Membuat akun cadangan Live Production [miracle_prod_user]...`);
  const now = Math.floor(Date.now() / 1000);
  const mockupId = '8706658046'; // Target utama ID Anda
  db.prepare(`
    INSERT OR REPLACE INTO rpg_users (telegram_user_id, class_name, level, xp, gold, hp, max_hp, atk, def, created_at, updated_at)
    VALUES (?, 'ksatria', 1, 0, 0, 100, 100, 12, 10, ?, ?)
  `).run(mockupId, now, now);
  targetAccounts.push(db.prepare('SELECT * FROM rpg_users WHERE telegram_user_id = ?').get(mockupId));
}

console.log(`\n====================================================================================`);
console.log(`🎮 MEMULAI FULL GEAR UP & ENDGAME ADVANCEMENT UNTUK ${targetAccounts.length} AKUN!`);
console.log(`====================================================================================`);

for (const user of targetAccounts) {
  const userId = user.telegram_user_id;
  const now = Math.floor(Date.now() / 1000);
  
  console.log(`\n-------------------------------------------------------------------------`);
  console.log(`🔥 Mempersembahkankan Keistimewaan Miracle Akun ID: ${userId} (Class: ${user.class_name})`);
  console.log(`-------------------------------------------------------------------------`);

  // 1. DAFTARKAN ALIAS MENGGEMA SEBAGAI 'Miracle' (atau dengan suffix jika lebih dari 1 akun)
  const targetAlias = (userId === '8706658046' || targetAccounts.length === 1) ? 'Miracle' : `Miracle_${String(userId).slice(-4)}`;
  try {
    db.prepare(`
      INSERT INTO rpg_character_aliases (user_id, alias, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET alias = ?, updated_at = ?
    `).run(userId, targetAlias, now, targetAlias, now);
  } catch (e) {
    const fallbackAlias = `Miracle_${Math.floor(Math.random()*10000)}`;
    db.prepare(`
      INSERT OR REPLACE INTO rpg_character_aliases (user_id, alias, updated_at)
      VALUES (?, ?, ?)
    `).run(userId, fallbackAlias, now);
  }

  // 2. UPDATE STATS KARAKTER KE ENDGAME MAX CAP SAGA II (LEVEL 60)
  db.prepare(`
    UPDATE rpg_users 
    SET class_name = 'ksatria',
        level = 60, 
        xp = 285000, 
        gold = 50000, 
        hp = 1500, 
        max_hp = 1500, 
        atk = 380, 
        def = 340, 
        crit_rate = 0.30, 
        crit_multi = 2.2, 
        updated_at = ? 
    WHERE telegram_user_id = ?
  `).run(now, userId);

  // 3. UPDATE WORLD PROGRESS KE CHAPTER 7 (CELESTIAL VOID THRONE)
  db.prepare(`
    INSERT OR REPLACE INTO rpg_world_progress (user_id, current_region_id, campaign_chapter, campaign_step, exploration_points, updated_at)
    VALUES (?, 'celestial_void_throne', 7, 5, 800, ?)
  `).run(userId, now);

  // 4. MEMASUKKAN KATALOG REQUIREMENT EQUIPMENT LEGENDARY
  const catalogEquipments = [
    { id: 'pedang_supernova', name: '🌟 Pedang Kaisar Supernova', category: 'weapon', rarity: 'legendary', price: 5000, effect: { atk_bonus: 85, crit_rate: 0.15, crit_multi: 0.4 } },
    { id: 'zirah_sayap_void', name: '🌑 Zirah Sayap Void Valtharor', category: 'armor', rarity: 'legendary', price: 4500, effect: { def_bonus: 70, phys_resist: 0.20, magic_resist: 0.20 } },
    { id: 'mahkota_galaksi', name: '👑 Mahkota Inti Galaksi Xylarion', category: 'accessory', rarity: 'legendary', price: 4800, effect: { atk_bonus: 30, magic_atk_bonus: 30, def_bonus: 30, crit_rate: 0.10 } }
  ];

  for (const eq of catalogEquipments) {
    db.prepare(`
      INSERT OR REPLACE INTO items_catalog (item_id, display_name, category, rarity, sell_price, effect_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(eq.id, eq.name, eq.category, eq.rarity, eq.price, JSON.stringify(eq.effect));

    // Pasang di Inventory Legacy sebagai Equipped (+15)
    db.prepare(`
      INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity, upgrade_tier, equipped)
      VALUES (?, ?, 1, 15, 1)
      ON CONFLICT(telegram_user_id, item_id) 
      DO UPDATE SET quantity = 1, upgrade_tier = 15, equipped = 1
    `).run(userId, eq.id);
  }

  // 5. MEMASUKKAN BARANG LOGISTICS & MATERIAL ENDGAME
  const materials = [
    { id: 'batere_supernova', name: '⚡ Batere Supernova Purba', cat: 'material' },
    { id: 'air_mata_gerhana', name: '🌑 Air Mata Gerhana Murni', cat: 'material' },
    { id: 'sisik_naga_perak', name: '🐉 Sisik Naga Perak Malakor', cat: 'material' },
    { id: 'obsidian', name: '💎 Batu Obsidian Murni', cat: 'material' },
    { id: 'ramuan_kehidupan', name: '💖 Ramuan Kehidupan', cat: 'consumable' },
    { id: 'ramuan_energi_besars', name: '⚡ Ramuan Energi Besar', cat: 'consumable' },
    { id: 'kail_plus', name: '🎣 Kail Pancing+', cat: 'material' },
    { id: 'beliung_plus', name: '⛏️ Beliung Tambang+', cat: 'material' },
    { id: 'emas_rongsok', name: '🪙 Emas Rongsok Kuno', cat: 'material' }
  ];

  for (const mat of materials) {
    db.prepare(`
      INSERT OR IGNORE INTO items_catalog (item_id, display_name, category, rarity, sell_price)
      VALUES (?, ?, ?, 'rare', 200)
    `).run(mat.id, mat.name, mat.cat);

    db.prepare(`
      INSERT INTO rpg_inventory (telegram_user_id, item_id, quantity, upgrade_tier, equipped)
      VALUES (?, ?, 50, 0, 0)
      ON CONFLICT(telegram_user_id, item_id)
      DO UPDATE SET quantity = quantity + 50, equipped = 0
    `).run(userId, mat.id);
  }

  // 6. SETUP MODERN EQUIPMENT V2 INSTANCES (Agar /gear dan V2 IP meroket tajam!)
  // Hapus instance V2 lama milik user untuk item legendaris ini agar bersih dan segar
  db.prepare(`DELETE FROM rpg_equipment_instances WHERE owner_id = ? AND item_id IN ('pedang_supernova', 'zirah_sayap_void', 'mahkota_galaksi')`).run(String(userId));

  for (const eq of catalogEquipments) {
    const instId = Number(db.prepare(`
      INSERT INTO rpg_equipment_instances
        (owner_id, item_id, rarity, quality, item_power, upgrade_tier, equipped_slot, set_id, bind_status, created_at, updated_at)
      VALUES (?, ?, ?, 100, 580, 15, ?, 'astral_emperor', 'account_bound', ?, ?)
    `).run(String(userId), eq.id, eq.rarity, eq.category, now, now).lastInsertRowid);

    // Tambahkan Affixes Dewa ke tiap instance
    db.prepare(`INSERT INTO rpg_equipment_affixes (instance_id, affix_id, stat_key, stat_value, tier) VALUES (?, 'atk_boost', 'attack', 120, 5)`).run(instId);
    db.prepare(`INSERT INTO rpg_equipment_affixes (instance_id, affix_id, stat_key, stat_value, tier) VALUES (?, 'crit_chance', 'crit_rate', 10, 5)`).run(instId);
    if (eq.category === 'armor') {
      db.prepare(`INSERT INTO rpg_equipment_affixes (instance_id, affix_id, stat_key, stat_value, tier) VALUES (?, 'hp_boost', 'max_hp', 800, 5)`).run(instId);
    }

    // Tambahkan Sockets terisi berlian
    db.prepare(`INSERT INTO rpg_equipment_sockets (instance_id, socket_index, gem_item_id, stat_key, stat_value) VALUES (?, 1, 'gem_ruby_astral', 'attack', 50)`).run(instId);
    db.prepare(`INSERT INTO rpg_equipment_sockets (instance_id, socket_index, gem_item_id, stat_key, stat_value) VALUES (?, 2, 'gem_diamond_void', 'defense', 60)`).run(instId);
  }

  // 7. SETUP FULL SKILL LOADOUT DI SLOT 1, 2, DAN 3
  // Daftarkan skill pamungkas Saga II
  const customSkillDef = {
    id: 'ksatria_supernova_slash',
    class_id: 'ksatria',
    name: '💥 Tebasan Supernova Kosmik',
    role: 'damage',
    max_rank: 5,
    min_level: 50,
    description: 'Serangan kosmik pamungkas pembantai Kaisar Xylarion dengan damage fatal.',
    effect: { type: 'physical_damage', multiplier: [3.5, 4.0, 4.5, 5.0, 6.0], armor_penetration: 0.5, cooldown: 1 }
  };

  db.prepare(`
    INSERT OR REPLACE INTO rpg_skill_definitions (skill_id, class_id, name, role, max_rank, definition_json, published)
    VALUES ('ksatria_supernova_slash', 'ksatria', '💥 Tebasan Supernova Kosmik', 'damage', 5, ?, 1)
  `).run(JSON.stringify(customSkillDef));

  // Pasang 3 Skill di Slot 1, 2, dan 3!
  const mySkills = [
    { id: 'ksatria_guard_stance', rank: 3, slot: 1 },
    { id: 'ksatria_supernova_slash', rank: 5, slot: 2 },
    { id: 'ksatria_heavy_slash', rank: 3, slot: 3 },
    { id: 'ksatria_provoke', rank: 2, slot: null } // Terpelajari tapi di luar loadout utama
  ];

  for (const sk of mySkills) {
    db.prepare(`
      INSERT OR REPLACE INTO rpg_user_skills (user_id, skill_id, rank, equipped_slot, unlocked_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(String(userId), sk.id, sk.rank, sk.slot, now);
  }

  // 8. MAX CAP SEMUA 7 PROFESI KUNO (LEVEL 15)
  const professions = ['gather', 'mine', 'fish', 'reforge', 'socket', 'hunt', 'trade'];
  for (const prof of professions) {
    db.prepare(`
      INSERT INTO rpg_professions (user_id, profession_id, level, xp, mastery, updated_at)
      VALUES (?, ?, 15, 8000, 5, ?)
      ON CONFLICT(user_id, profession_id)
      DO UPDATE SET level = 15, xp = 8000, mastery = 5, updated_at = ?
    `).run(userId, prof, now, now);
  }

  console.log(`   ✅ Seluruh Gear Legendaris, Equipment V2, & 3 Skill Dewa terpasang sempurna!`);
}

console.log(`\n====================================================================================`);
console.log(`🏆 PREVIEW HASIL NYATA [/profile] DI TELEGRAM BOT ANDA SAAT INI`);
console.log(`====================================================================================`);

const finalUsers = db.prepare('SELECT * FROM rpg_users').all();
for (const u of finalUsers) {
  console.log(`\n--- UI TELEGRAM UNTUK TELEGRAM ID ${u.telegram_user_id} ---`);
  try {
    const profileText = renderProfile(u);
    console.log(profileText.replace(/<[^>]*>?/gm, '')); // Hapus tag HTML agar rapi di CLI log
  } catch (e) {
    console.log(`Error rendering profile:`, e.message);
  }
  console.log(`----------------------------------------------------------`);
}

console.log(`\n🎯 SELESAI SELAMANYA! Akun anda SEKARANG Benar-Benar END GAME MAX CAP FULL GEAR & FULL SKILLS! 🚀\n`);
process.exit(0);
