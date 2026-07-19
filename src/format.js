// src/format.js
// Helper functions untuk formatting message Telegram yang clean & rapi

/**
 * Progress bar dengan Unicode blocks
 * @param {number} current - Nilai saat ini
 * @param {number} max - Nilai maksimal
 * @param {number} length - Panjang bar (default: 10)
 * @returns {string} Progress bar
 */
function progressBar(current, max, length = 10) {
  const filled = Math.min(length, Math.round((Math.max(0, current) / max) * length));
  const empty = length - filled;
  const percent = Math.round((Math.max(0, current) / max) * 100);
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
}

/**
 * Divider line
 * @param {string} char - Karakter divider
 * @param {number} length - Panjang divider
 * @returns {string} Divider line
 */
function divider(char = '═', length = 30) {
  return char.repeat(length);
}

/**
 * Box dengan title
 * @param {string} title - Judul box
 * @param {string} content - Isi box
 * @returns {string} Formatted box
 */
function box(title, content) {
  const line = '═'.repeat(title.length + 4);
  return `╔${line}╗\n║  ${title}  ║\n╚${line}╝\n\n${content}`;
}

/**
 * Section header
 * @param {string} title - Judul section
 * @param {string} emoji - Emoji untuk judul
 * @returns {string} Section header
 */
function sectionHeader(title, emoji = '') {
  const prefix = emoji ? `${emoji} ` : '';
  return `\n${prefix}**${title}**\n${divider('─', 30)}`;
}

/**
 * Key-value pair
 * @param {string} key - Nama field
 * @param {string} value - Nilai field
 * @param {number} indent - Indentasi (default: 2)
 * @returns {string} Key-value pair
 */
function kvPair(key, value, indent = 2) {
  const spaces = ' '.repeat(indent);
  return `${spaces}• ${key}: ${value}`;
}

/**
 * Numbered list
 * @param {Array} items - Array of items
 * @param {string} prefix - Prefix numbering
 * @returns {string} Numbered list
 */
function numberedList(items, prefix = '   ') {
  return items.map((item, i) => `${prefix}${i + 1}. ${item}`).join('\n');
}

/**
 * Bullet list
 * @param {Array} items - Array of items
 * @param {string} bullet - Bullet character
 * @param {number} indent - Indentasi
 * @returns {string} Bullet list
 */
function bulletList(items, bullet = '•', indent = 2) {
  const spaces = ' '.repeat(indent);
  return items.map(item => `${spaces}${bullet} ${item}`).join('\n');
}

/**
 * Command list (untuk help menu)
 * @param {Array} commands - Array of {cmd, desc}
 * @param {number} indent - Indentasi
 * @returns {string} Command list
 */
function commandList(commands, indent = 3) {
  const spaces = ' '.repeat(indent);
  return commands.map(c => `${spaces}/${c.cmd} — ${c.desc}`).join('\n');
}

/**
 * Stat line dengan icon
 * @param {string} icon - Emoji icon
 * @param {string} label - Nama stat
 * @param {number|string} value - Nilai stat
 * @param {string} extra - Info tambahan (opsional)
 * @returns {string} Stat line
 */
function statLine(icon, label, value, extra = '') {
  const extraStr = extra ? ` _${extra}_` : '';
  return `${icon} **${label}**: ${value}${extraStr}`;
}

/**
 * HP/MP bar dengan label
 * @param {string} icon - Emoji
 * @param {string} label - Nama bar
 * @param {number} current - Nilai saat ini
 * @param {number} max - Nilai maksimal
 * @param {number} barLength - Panjang bar
 * @returns {string} HP bar
 */
function hpBar(icon, label, current, max, barLength = 8) {
  const bar = progressBar(current, max, barLength);
  return `${icon} **${label}**: ${bar} ${current}/${max}`;
}

/**
 * Separator line
 * @returns {string} Separator
 */
function separator() {
  return '───────────────────────────';
}

/**
 * Footer
 * @param {string} text - Teks footer
 * @returns {string} Footer
 */
function footer(text) {
  return `\n_${text}_`;
}

/**
 * Success message
 * @param {string} text - Teks pesan
 * @returns {string} Success message
 */
function success(text) {
  return `✅ ${text}`;
}

/**
 * Error message
 * @param {string} text - Teks pesan
 * @returns {string} Error message
 */
function error(text) {
  return `❌ ${text}`;
}

/**
 * Warning message
 * @param {string} text - Teks pesan
 * @returns {string} Warning message
 */
function warning(text) {
  return `⚠️ ${text}`;
}

/**
 * Info message
 * @param {string} text - Teks pesan
 * @returns {string} Info message
 */
function info(text) {
  return `ℹ️ ${text}`;
}

module.exports = {
  progressBar,
  divider,
  box,
  sectionHeader,
  kvPair,
  numberedList,
  bulletList,
  commandList,
  statLine,
  hpBar,
  separator,
  footer,
  success,
  error,
  warning,
  info,
};
