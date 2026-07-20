// src/format.js
// Helper functions untuk formatting message Telegram — Mobile-friendly, Discord game bot style

/**
 * Progress bar dengan Unicode blocks — compact untuk mobile
 */
function progressBar(current, max, length = 8) {
  if (!max || max <= 0) return '░'.repeat(length) + ' 0%';
  const filled = Math.min(length, Math.round((Math.max(0, current) / max) * length));
  const empty = length - filled;
  const percent = Math.round((Math.max(0, current) / max) * 100);
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percent}%`;
}

/**
 * Divider — pendek agar tidak wrap di mobile (max 20 char)
 */
function divider(char = '━', length = 20) {
  return char.repeat(length);
}

/**
 * Section header — Discord style, compact
 */
function sectionHeader(title, emoji = '') {
  const prefix = emoji ? `${emoji} ` : '';
  return `\n<b>◈ ${prefix}${title}</b>\n`;
}

/**
 * Key-value pair — compact
 */
function kvPair(key, value, desc = '') {
  const descStr = desc ? ` <i>${desc}</i>` : '';
  return `  <b>${key}</b> ${value}${descStr}`;
}

/**
 * HP/MP bar dengan label — HTML
 */
function hpBar(icon, label, current, max, barLength = 8) {
  const bar = progressBar(current, max, barLength);
  return `${icon} <b>${label}</b> ${bar} <code>${Math.max(0, current)}/${max}</code>`;
}

/**
 * Stat line — HTML
 */
function statLine(icon, label, value, extra = '') {
  const extraStr = extra ? ` <i>(${extra})</i>` : '';
  return `${icon} <b>${label}:</b> ${value}${extraStr}`;
}

/**
 * Separator — pendek mobile-safe
 */
function separator() {
  return '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';
}

/**
 * Footer — italic HTML
 */
function footer(text) {
  return `\n<i>${text}</i>`;
}

// Retained untuk compatibility
function box(title, content) {
  return `<b>【 ${title} 】</b>\n\n${content}`;
}

function numberedList(items, prefix = '   ') {
  return items.map((item, i) => `${prefix}${i + 1}. ${item}`).join('\n');
}

function bulletList(items, bullet = '•', indent = 2) {
  const spaces = ' '.repeat(indent);
  return items.map(item => `${spaces}${bullet} ${item}`).join('\n');
}

function commandList(commands, indent = 3) {
  const spaces = ' '.repeat(indent);
  return commands.map(c => `${spaces}/${c.cmd} — ${c.desc}`).join('\n');
}

function success(text) { return `✅ ${text}`; }
function error(text)   { return `❌ ${text}`; }
function warning(text) { return `⚠️ ${text}`; }
function info(text)    { return `ℹ️ ${text}`; }

module.exports = {
  progressBar, divider, box, sectionHeader, kvPair,
  numberedList, bulletList, commandList,
  statLine, hpBar, separator, footer,
  success, error, warning, info,
};
