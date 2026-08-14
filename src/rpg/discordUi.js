const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const NAVIGATION = [
  ['profile', 'Profile'], ['inv', 'Inventory'], ['shop', 'Shop'], ['gear', 'Gear'], ['skill', 'Skills'],
  ['campaign', 'Campaign'], ['dungeon', 'Dungeon'], ['party', 'Party'], ['guild', 'Guild'], ['guide', 'Guide'],
];

function navigationRows(active = 'profile', page = 1) {
  const pages = [NAVIGATION.slice(0, 5), NAVIGATION.slice(5)];
  const safePage = page === 2 ? 2 : 1;
  const buttons = pages[safePage - 1].map(([command, label]) => new ButtonBuilder()
    .setCustomId(`discord:nav:${command}`)
    .setLabel(`${label}${active === command ? ' ✓' : ''}`)
    .setStyle(active === command ? ButtonStyle.Success : ButtonStyle.Secondary));
  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('discord:navpage:1').setLabel('◀').setStyle(ButtonStyle.Secondary).setDisabled(safePage === 1),
    new ButtonBuilder().setCustomId('discord:navpage:2').setLabel('▶').setStyle(ButtonStyle.Secondary).setDisabled(safePage === 2),
  );
  return [new ActionRowBuilder().addComponents(buttons), controls];
}

function panelOptions(active, page = 1, extraRows = []) {
  return { components: [...navigationRows(active, page), ...extraRows] };
}

function numberedActionRows(prefix, items, actionLabel = 'Pilih', max = 20) {
  const buttons = items.slice(0, max).map((item, index) => new ButtonBuilder()
    .setCustomId(`${prefix}:${index + 1}`)
    .setLabel(`${actionLabel} ${index + 1}`)
    .setStyle(ButtonStyle.Primary));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  return rows;
}

function dedupeRows(rows) {
  const seen = new Set();
  const result = [];
  for (const row of rows || []) {
    const components = (row.components || []).filter(component => {
      const id = component.data?.custom_id;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    if (components.length) result.push(new ActionRowBuilder().addComponents(components));
  }
  return result.slice(0, 5);
}module.exports = { NAVIGATION, navigationRows, panelOptions, numberedActionRows, dedupeRows };