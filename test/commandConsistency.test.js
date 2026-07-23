const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function javascriptFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return javascriptFiles(target);
    return entry.isFile() && entry.name.endsWith('.js') ? [target] : [];
  });
}

test('semua command Telegram memiliki handler dan tidak ada collision tersembunyi', () => {
  const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
  const menuBlock = indexSource.match(/const botCommands = \[([\s\S]*?)\];\s*\n\s*bot\.telegram\.setMyCommands/);
  assert.ok(menuBlock, 'Daftar botCommands tidak ditemukan');
  const published = [...menuBlock[1].matchAll(/command:\s*'([a-z0-9_]+)'/g)].map(match => match[1]);
  assert.equal(new Set(published).size, published.length, 'Command Telegram duplikat');

  const registrations = new Map([['start', 1]]);
  const source = javascriptFiles(path.join(root, 'src'))
    .concat(path.join(root, 'index.js'))
    .map(file => fs.readFileSync(file, 'utf8'))
    .join('\n');
  for (const match of source.matchAll(/bot\.command\(\s*'([a-z0-9_]+)'/g)) {
    registrations.set(match[1], (registrations.get(match[1]) || 0) + 1);
  }
  for (const match of source.matchAll(/bot\.command\(\s*\[([^\]]+)\]/g)) {
    for (const command of match[1].matchAll(/'([a-z0-9_]+)'/g)) {
      registrations.set(command[1], (registrations.get(command[1]) || 0) + 1);
    }
  }

  for (const command of published) {
    assert.ok(registrations.has(command), `/${command} dipublikasikan tanpa handler`);
  }
  const collisions = [...registrations.entries()]
    .filter(([command, count]) => count > 1 && command !== 'dungeon');
  assert.deepEqual(collisions, [], `Collision command tidak disengaja: ${JSON.stringify(collisions)}`);
  assert.equal(registrations.get('dungeon'), 2, '/dungeon harus memiliki router baru dan handler raid lama');
});

test('panduan utama memakai syntax command produksi', () => {
  const help = fs.readFileSync(path.join(root, 'src/rpg/help.js'), 'utf8');
  for (const command of ['/profile', '/world', '/dungeon', '/coop', '/party', '/gear', '/trade']) {
    assert.match(help, new RegExp(command.replace('/', '\\/')), `${command} belum ada di /helprpg`);
  }
  assert.doesNotMatch(help, /trade offer item \[item_id\]/);
  assert.match(help, /trade offer item \[nomor \/inv\]/);
  assert.match(help, /dungeon raid/);
});
