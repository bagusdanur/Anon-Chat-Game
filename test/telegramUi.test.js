const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { HELP_PAGES, pageMessage, indexMessage } = require('../src/rpg/help');

const TELEGRAM_MESSAGE_LIMIT = 4096;
const root = path.join(__dirname, '..');

test('seluruh halaman /helprpg aman di bawah batas pesan Telegram', () => {
  assert.ok(indexMessage().text.length <= TELEGRAM_MESSAGE_LIMIT);
  for (const page of HELP_PAGES) {
    const rendered = pageMessage(page.id);
    assert.ok(rendered, `Halaman ${page.id} tidak dapat dirender`);
    assert.ok(
      rendered.text.length <= TELEGRAM_MESSAGE_LIMIT,
      `Halaman ${page.id} sepanjang ${rendered.text.length} karakter`,
    );
  }
});

test('UI utama tetap ringkas dan memakai input angka untuk daftar pemain', () => {
  const profile = fs.readFileSync(path.join(root, 'src/rpg/profile.js'), 'utf8');
  const guide = fs.readFileSync(path.join(root, 'src/rpg/guide.js'), 'utf8');
  const dungeon = fs.readFileSync(path.join(root, 'src/rpg/longDungeon.js'), 'utf8');
  const equipment = fs.readFileSync(path.join(root, 'src/rpg/equipment.js'), 'utf8');

  assert.match(profile, /LANGKAH BERIKUTNYA/);
  assert.match(profile, /Skill Loadout/);
  assert.match(profile, /formatNumberId\(effectiveHp\)/);
  assert.match(profile, /Campaign utama selesai/);
  assert.doesNotMatch(profile, /Equipment V2|Perlengkapan Tempaan/);
  assert.match(equipment, /bot\.command\('equip'/);
  assert.match(equipment, /bot\.command\('upgrade'/);
  assert.match(guide, /dungeonNumber/);
  assert.match(dungeon, /index \+ 1/);
  assert.doesNotMatch(guide, /<code>\/reforge<\/code>|<code>\/socket<\/code>/);
});
