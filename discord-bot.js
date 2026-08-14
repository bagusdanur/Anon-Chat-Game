require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
} = require("discord.js");
const { setupRpg } = require("./src/rpg/controller");
const { ensureDiscordIdentity } = require("./src/rpg/discordIdentity");
const { db } = require("./src/db");
const { createSocialService } = require("./src/rpg/services/social");
const { createLongDungeonService } = require("./src/rpg/services/longDungeon");
const { createEquipmentService } = require("./src/rpg/services/equipment");
const {
  xpToNextLevel,
  calcStats,
  getInventory,
  getOrCreateUser,
  createUser,
  getCatalogItem,
} = require("./src/rpg/db_rpg");
const { createDirectTradeService } = require("./src/rpg/services/directTrade");
const { createMarketplaceService } = require("./src/rpg/services/marketplace");
const {
  SHOP_ITEMS,
  limitedShopPurchased,
  buildInventoryText,
  ORE_CONVERSION_RATES,
} = require("./src/rpg/economy");
const { renderProfile, RARITY_EMOJI } = require("./src/rpg/profile");
const discordUi = require("./src/rpg/discordUi");
const { orderInventory } = require("./src/rpg/inputResolvers");
const directTrade = createDirectTradeService(db);
const marketplace = createMarketplaceService(db);
const social = createSocialService(db);
const dungeonService = createLongDungeonService(db, {
  xpToNextLevel,
  calcStats,
});
const equipmentService = createEquipmentService(db);
const activePartners = new Map();
const activeDungeonPanels = new Map();
const DISCORD_PAGE_SIZE = 25;
const PRIVATE_COMMANDS = new Set([
  "profile",
  "alias",
  "inv",
  "gear",
  "skill",
  "shop",
  "buy",
  "sell",
  "use",
  "craft",
  "market",
  "trade",
  "equip",
  "unequip",
  "upgrade",
  "refine",
  "salvage",
  "daily",
]);
const RPG_CHANNELS = {
  "rpg-start": ["rpg", "profile", "alias"],
  "rpg-story": ["world", "travel", "campaign", "quest", "season"],
  "rpg-explore": [
    "explore",
    "gather",
    "mine",
    "fish",
    "hunt",
    "profession",
    "catalog",
  ],
  "rpg-dungeon": [
    "dungeon",
    "adventure",
    "coop",
    "raid",
    "bounty",
    "tower",
    "worldboss",
  ],
  "rpg-market": [
    "shop",
    "buy",
    "sell",
    "craft",
    "market",
    "trade",
    "salvage",
    "refine",
    "ore",
  ],
  "rpg-guild": ["party", "guild", "duel", "rank", "achievement", "collection"],
  "rpg-help": ["guide", "helprpg", "rpghelp", "bantuanrpg"],
};
const COMMAND_CHANNEL = Object.fromEntries(
  Object.entries(RPG_CHANNELS).flatMap(([channel, commands]) =>
    commands.map((command) => [command, channel]),
  ),
);
const CHARACTER_REQUIRED = new Set([
  "campaign",
  "explore",
  "dungeon",
  "adventure",
  "party",
  "coop",
  "guild",
  "duel",
  "worldboss",
  "raid",
  "bounty",
  "coopcampaign",
  "tower",
  "quest",
  "hunt",
  "fish",
  "mine",
  "profession",
  "gather",
  "shop",
  "buy",
  "sell",
  "use",
  "craft",
  "market",
  "trade",
  "salvage",
  "refine",
  "equip",
  "unequip",
  "upgrade",
  "ore",
  "daily",
  "alias",
]);
async function resolveRpgChannel(guild, channelName) {
  if (!guild) return null;
  const channels = await guild.channels.fetch();
  return (
    channels.find(
      (channel) =>
        channel && channel.name === `・${channelName}` && channel.isTextBased(),
    ) || null
  );
}
function channelMention(channel) {
  return channel ? `<#${channel.id}>` : `#・${channel}`;
}
function discordPageButtons(prefix, page, totalPages) {
  return [discordUi.paginationRow(prefix, page, totalPages)];
}
function inventoryPage(userId, page = 1) {
  const items = orderInventory(getInventory(userId));
  const totalPages = Math.max(1, Math.ceil(items.length / DISCORD_PAGE_SIZE));
  const safePage = Math.min(totalPages, Math.max(1, page));
  const rows = items.slice(
    (safePage - 1) * DISCORD_PAGE_SIZE,
    safePage * DISCORD_PAGE_SIZE,
  );
  const text = formatDiscordText(buildInventoryText(userId));
  const components = [];
  if (rows.length) {
    const selector = new StringSelectMenuBuilder()
      .setCustomId("discord:inv:select")
      .setPlaceholder(`Pilih item untuk aksi · ${safePage}/${totalPages}`)
      .addOptions(
        rows.map((item, index) => ({
          label:
            `${(safePage - 1) * DISCORD_PAGE_SIZE + index + 1}. ${item.display_name}`.slice(
              0,
              100,
            ),
          description:
            `${item.category} · ${item.rarity} · x${item.quantity}`.slice(
              0,
              100,
            ),
          value: String((safePage - 1) * DISCORD_PAGE_SIZE + index + 1),
        })),
      );
    components.push(new ActionRowBuilder().addComponents(selector));
    components.push(...discordPageButtons("discord:inv", safePage, totalPages));
  }
  components.push(...discordUi.navigationRows("inv"));
  return { text, components };
}
function discordShopPage(userId, page = 1) {
  const user = getOrCreateUser(userId);
  const sections = [...new Set(SHOP_ITEMS.map((item) => item.section))];
  const safePage = Math.min(sections.length, Math.max(1, page));
  const section = sections[safePage - 1];
  const items = SHOP_ITEMS.filter((item) => item.section === section);
  const lines = items
    .map((item) => {
      const catalog = getCatalogItem(item.item_id);
      const rarity = RARITY_EMOJI[catalog?.rarity] || "";
      let suffix = "";
      if ((user?.level || 1) < (item.min_level || 1))
        suffix = ` · 🔒 Lv.${item.min_level}`;
      else if (item.weekly_limit) {
        const remaining = Math.max(
          0,
          item.weekly_limit - limitedShopPurchased(userId, item.item_id),
        );
        suffix = ` · sisa ${remaining}/${item.weekly_limit} minggu ini`;
      }
      return `[${item.id}] ${rarity} **${catalog?.display_name || item.item_id}** — ${item.buy_price.toLocaleString()}g${suffix}`;
    })
    .join("\n");
  const selector = new StringSelectMenuBuilder()
    .setCustomId("discord:shop:select")
    .setPlaceholder("Pilih item untuk dibeli")
    .addOptions(
      items.slice(0, 25).map((item) => {
        const catalog = getCatalogItem(item.item_id);
        return {
          label: `${item.id}. ${catalog?.display_name || item.item_id}`.slice(
            0,
            100,
          ),
          description:
            `${item.buy_price.toLocaleString()}g${(user?.level || 1) < (item.min_level || 1) ? ` • Butuh Lv.${item.min_level}` : ""}`.slice(
              0,
              100,
            ),
          value: String(item.id),
        };
      }),
    );
  return {
    text: `🏪 **TOKO — ${section}**\n💰 Saldo: **${user?.gold || 0}g**\n*Beli: pilih item dari dropdown*\n\n${lines}\n\n*Halaman ${safePage}/${sections.length} · Nomor item tetap global.*`,
    components: [
      new ActionRowBuilder().addComponents(selector),
      ...discordPageButtons("discord:shop", safePage, sections.length),
      ...discordUi.navigationRows("shop"),
    ],
  };
}
function discordAutocompleteChoices(command, userId) {
  const inventory = orderInventory(getInventory(userId));
  const inventoryChoices = (filter = () => true) => inventory
    .map((item, index) => ({ item, number: index + 1 }))
    .filter(({ item }) => filter(item))
    .map(({ item, number }) => ({
      name: `${number}. ${item.display_name} x${item.quantity}`.slice(0, 100),
      value: String(number),
    }));
  if (["inv", "sell"].includes(command)) return inventoryChoices();
  if (command === "use") return inventoryChoices(item => item.category === "consumable");
  if (command === "salvage") {
    return inventoryChoices(item => ["weapon", "staff", "armor", "accessory"].includes(item.category));
  }
  if (command === "refine") {
    return inventoryChoices(item => ["tembaga", "besi", "perak"].includes(item.item_id) && item.quantity >= 5);
  }
  if (command === "ore") {
    return inventoryChoices(item => Boolean(ORE_CONVERSION_RATES[item.item_id]))
      .map(choice => ({ ...choice, value: `convert ${choice.value} 1` }));
  }
  const gear = equipmentService.list(userId);
  if (["equip", "unequip", "upgrade"].includes(command)) {
    return gear
      .map((item, index) => ({ item, number: index + 1 }))
      .filter(({ item }) => command !== "unequip" || item.equipped_slot)
      .map(({ item, number }) => ({
        name: `${number}. ${item.display_name} +${item.upgrade_tier} · ${item.item_power} IP${item.equipped_slot ? " · Terpasang" : ""}`.slice(0, 100),
        value: String(number),
      }));
  }
  if (command === "gear") {
    return gear.flatMap((item, index) => {
      const number = index + 1;
      const primaryAction = item.equipped_slot ? "unequip" : "equip";
      return [
        { name: `${primaryAction === "equip" ? "Pasang" : "Lepas"} ${number}. ${item.display_name}`.slice(0, 100), value: `${primaryAction} ${number}` },
        { name: `Bandingkan ${number}. ${item.display_name}`.slice(0, 100), value: `compare ${number}` },
        { name: `Upgrade ${number}. ${item.display_name}`.slice(0, 100), value: `upgrade ${number}` },
      ];
    });
  }
  return [];
}
const COMMANDS = [
  ["rpg", "Menu utama RPG"],
  ["guide", "Panduan RPG"],
  ["helprpg", "Panduan lengkap RPG"],
  ["rpghelp", "Alias panduan RPG"],
  ["bantuanrpg", "Alias panduan RPG"],
  ["profile", "Profil karakter"],
  ["alias", "Alias karakter"],
  ["world", "Dunia RPG"],
  ["travel", "Pindah region"],
  ["campaign", "Campaign"],
  ["explore", "Eksplorasi"],
  ["skill", "Skill tree"],
  ["build", "Build"],
  ["gear", "Equipment"],
  ["dungeon", "Dungeon"],
  ["adventure", "Adventure"],
  ["party", "Party"],
  ["coop", "Co-op"],
  ["guild", "Guild"],
  ["duel", "PvP Duel"],
  ["worldboss", "World Boss"],
  ["raid", "Raid"],
  ["bounty", "Bounty"],
  ["coopcampaign", "Campaign co-op"],
  ["tower", "Tower"],
  ["season", "Season"],
  ["rank", "Leaderboard"],
  ["achievement", "Achievement"],
  ["collection", "Koleksi"],
  ["quest", "Quest"],
  ["hunt", "Hunt"],
  ["fish", "Fishing"],
  ["mine", "Mining"],
  ["profession", "Profesi"],
  ["gather", "Gathering"],
  ["catalog", "Katalog"],
  ["inv", "Inventory"],
  ["shop", "Shop"],
  ["buy", "Beli"],
  ["sell", "Jual"],
  ["use", "Gunakan"],
  ["craft", "Crafting"],
  ["market", "Marketplace"],
  ["trade", "Trade"],
  ["salvage", "Salvage"],
  ["refine", "Refine"],
  ["equip", "Equip"],
  ["unequip", "Unequip"],
  ["upgrade", "Upgrade"],
  ["ore", "Ore"],
  ["daily", "Daily"],
];
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const handlers = new Map();
const actions = new Map();

function cleanText(value) {
  return String(value)
    .replace(/<b>(.*?)<\/b>/gis, "**$1**")
    .replace(/<strong>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<i>(.*?)<\/i>/gis, "*$1*")
    .replace(/<em>(.*?)<\/em>/gis, "*$1*")
    .replace(/<code>(.*?)<\/code>/gis, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
function formatDiscordText(value) {
  let text = cleanText(value).replace(/\r/g, "");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}
function splitDiscordText(value, limit = 1900) {
  const text = formatDiscordText(value);
  if (text.length <= limit) return [text];
  const chunks = [];
  let current = "";
  for (const line of text.split("\n")) {
    if ((current + "\n" + line).trim().length > limit && current) {
      chunks.push(current.trim());
      current = "";
    }
    if (line.length > limit) {
      for (let i = 0; i < line.length; i += limit) {
        if (current) {
          chunks.push(current.trim());
          current = "";
        }
        chunks.push(line.slice(i, i + limit));
      }
    } else current += (current ? "\n" : "") + line;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
function contextualSelectionRows(command, content) {
  if (command === "ore") {
    const matches = [
      ...content.matchAll(/`?\[(\d+)\]`?\s+(.+?)\s+x(\d+)\s+(?:â†’|→)/g),
    ].slice(0, 25);
    if (!matches.length) return [];
    const select = new StringSelectMenuBuilder()
      .setCustomId("discord:ore:select")
      .setPlaceholder("Pilih material yang akan dilebur")
      .addOptions(
        matches.map((match) => ({
          label: `${match[1]}. ${match[2]}`.replace(/\*\*/g, "").slice(0, 100),
          description: `Tersedia ${match[3]} buah`.slice(0, 100),
          value: `${match[1]}:${match[3]}`,
        })),
      );
    return [new ActionRowBuilder().addComponents(select)];
  }
  if (!["gear", "skill"].includes(command)) return [];
  const matches = [
    ...content.matchAll(/`?\[(\d+)\]`?\s+\*\*([^*\n]+)\*\*/g),
  ].slice(0, 25);
  if (!matches.length) return [];
  const select = new StringSelectMenuBuilder()
    .setCustomId(`discord:${command}:select`)
    .setPlaceholder(command === "gear" ? "Pilih gear" : "Pilih skill")
    .addOptions(
      matches.map((match) => ({
        label: `${match[1]}. ${match[2]}`.slice(0, 100),
        value: match[1],
      })),
    );
  return [new ActionRowBuilder().addComponents(select)];
}
function discordPayloads(
  message,
  options = {},
  privateReply = false,
  command = null,
) {
  const chunks = splitDiscordText(message);
  const panelCommands = new Set(["profile", "inv", "shop", "gear", "skill"]);
  return chunks.map((content, index) => {
    const actionRows = index === chunks.length - 1 ? buttons(options) : [];
    const contextualRows =
      index === chunks.length - 1
        ? contextualSelectionRows(command, content)
        : [];
    const navigation =
      index === chunks.length - 1 && panelCommands.has(command)
        ? discordUi.navigationRows(command)
        : [];
    const combined = [...actionRows, ...contextualRows, ...navigation];
    return {
      embeds: [new EmbedBuilder().setColor(0x7c3aed).setDescription(content)],
      components: combined.slice(0, 5),
      ...(privateReply ? { flags: MessageFlags.Ephemeral } : {}),
    };
  });
}
async function sendDiscordUser(user, message, options = {}, command = null) {
  let result = null;
  for (const payload of discordPayloads(message, options, false, command))
    result = await user.send(payload);
  return result;
}
async function upsertDiscordDungeonPanel(chatId, message, options = {}) {
  const raw = String(chatId);
  const discordId = raw.startsWith("discord:") ? raw.slice(8) : null;
  if (!discordId) return null;
  const user = await client.users.fetch(discordId).catch(() => null);
  if (!user) return null;
  const payloads = discordPayloads(message, options, false, null);
  const previous = activeDungeonPanels.get(raw);
  if (previous && payloads.length === 1) {
    const edited = await previous.edit(payloads[0]).catch(() => null);
    if (edited) return edited;
  }
  const sent = await user.send(payloads[0]);
  activeDungeonPanels.set(raw, sent);
  for (const payload of payloads.slice(1)) await user.send(payload);
  return sent;
}
function buttons(options) {
  const keyboard =
    options && options.reply_markup && options.reply_markup.inline_keyboard;
  if (!Array.isArray(keyboard)) return [];
  const choices = keyboard
    .flat()
    .filter((button) => button && button.callback_data);
  if (choices.length > 5) {
    const uniqueChoices = [
      ...new Map(
        choices.map((button) => [String(button.callback_data), button]),
      ).values(),
    ];
    const rows = [];
    for (
      let offset = 0;
      offset < uniqueChoices.length && rows.length < 5;
      offset += 25
    ) {
      const select = new StringSelectMenuBuilder()
        .setCustomId(`discord:callback-select:${rows.length}`)
        .setPlaceholder(
          rows.length === 0 ? "Pilih aksi" : `Pilih aksi (${rows.length + 1})`,
        )
        .addOptions(
          uniqueChoices.slice(offset, offset + 25).map((button) => ({
            label: String(button.text || "Pilih").slice(0, 100),
            value: String(button.callback_data).slice(0, 100),
          })),
        );
      rows.push(new ActionRowBuilder().addComponents(select));
    }
    return rows;
  }
  return keyboard.slice(0, 5).map((row) =>
    new ActionRowBuilder().addComponents(
      row.slice(0, 5).map((b) =>
        new ButtonBuilder()
          .setCustomId(String(b.callback_data || "noop").slice(0, 100))
          .setLabel(String(b.text || "Pilih").slice(0, 80))
          .setStyle(
            /tolak|cancel|batal|leave|keluar|hapus|reject/i.test(String(b.text))
              ? ButtonStyle.Danger
              : /terima|accept|mulai|lanjut|pilih|beli|buy|gunakan|equip|upgrade/i.test(
                    String(b.text),
                  )
                ? ButtonStyle.Success
                : /kembali|prev|next|halaman|guide|info/i.test(String(b.text))
                  ? ButtonStyle.Secondary
                  : ButtonStyle.Primary,
          ),
      ),
    ),
  );
}
function ctxFor(interaction, text = "") {
  const key = ensureDiscordIdentity(interaction.user.id, interaction.guildId);
  let answered = interaction.replied;
  const pending = [];
  const ctx = {
    chat: { id: key },
    from: { id: interaction.user.id },
    message: { text, message_id: interaction.id },
    interaction,
    update: {
      update_id: interaction.id,
      callback_query: interaction.isButton()
        ? { data: interaction.customId }
        : undefined,
    },
    callbackQuery: interaction.isButton()
      ? { data: interaction.customId }
      : undefined,
    telegram: {
      sendMessage: async (chatId, message, options = {}) => {
        const raw = String(chatId);
        const discordId = raw.startsWith("discord:") ? raw.slice(8) : null;
        if (!discordId) return null;
        const user = await client.users.fetch(discordId).catch(() => null);
        if (!user) return null;
        return sendDiscordUser(user, message, options).catch(() => null);
      },
      copyMessage: async () => null,
    },
    reply: async (message, options = {}) => {
      const payloads = discordPayloads(
        message,
        options,
        PRIVATE_COMMANDS.has(
          interaction.commandName || interaction.__discordCommandName,
        ),
        interaction.commandName || interaction.__discordCommandName,
      );
      if (!answered) {
        answered = true;
        const first = interaction.deferred
          ? interaction.editReply(payloads[0])
          : interaction.reply(payloads[0]);
        pending.push(first);
        for (const payload of payloads.slice(1))
          pending.push(first.then(() => interaction.followUp(payload)));
        return first;
      }
      let operation = interaction.followUp(payloads[0]);
      pending.push(operation);
      for (const payload of payloads.slice(1))
        pending.push(operation.then(() => interaction.followUp(payload)));
      return operation;
    },
    editMessageText: async (message, options = {}) => {
      answered = true;
      const payloads = discordPayloads(
        message,
        options,
        PRIVATE_COMMANDS.has(
          interaction.commandName || interaction.__discordCommandName,
        ),
        interaction.commandName || interaction.__discordCommandName,
      );
      const updated = interaction.deferred
        ? await interaction.editReply(payloads[0])
        : await interaction.update(payloads[0]);
      for (const payload of payloads.slice(1))
        await interaction.followUp(payload);
      return updated;
    },
    answerCbQuery: async () => {
      if (
        (interaction.isButton() || interaction.isStringSelectMenu()) &&
        !interaction.replied &&
        !interaction.deferred
      ) {
        answered = true;
        await interaction.deferUpdate();
      }
    },
    flush: async () => {
      if (pending.length) await Promise.allSettled(pending);
    },
  };
  return ctx;
}
const adapter = {
  command(name, ...args) {
    const handler = args[args.length - 1];
    for (const commandName of Array.isArray(name) ? name : [name])
      handlers.set(commandName, handler);
  },
  action(name, ...args) {
    actions.set(name, args[args.length - 1]);
  },
  on() {},
  telegram: {
    sendMessage: async (chatId, message, options = {}) => {
      const raw = String(chatId);
      const discordId = raw.startsWith("discord:") ? raw.slice(8) : null;
      if (!discordId) return null;
      const user = await client.users.fetch(discordId).catch(() => null);
      return user
        ? sendDiscordUser(user, message, options, null).catch(() => null)
        : null;
    },
    upsertDungeonPanel: upsertDiscordDungeonPanel,
  },
};
setupRpg(adapter, {
  getPartnerId: (userId) => activePartners.get(String(userId)) || null,
  rateLimitCommand: (ctx, next) =>
    typeof next === "function" ? next() : undefined,
});
adapter.action(/^discord:duo:join:(\d+):(\d+)$/, async (ctx) => {
  const inviterDiscordId = ctx.match[1];
  const dungeonNumber = Number(ctx.match[2]);
  const inviterKey = ensureDiscordIdentity(
    inviterDiscordId,
    ctx.interaction.guildId,
  );
  const acceptedParty = social.acceptInvite(ctx.chat.id);
  if (!acceptedParty.success)
    return ctx.interaction.reply({
      content: `Gagal bergabung: ${acceptedParty.reason}`,
      flags: MessageFlags.Ephemeral,
    });
  const inviter = getOrCreateUser(inviterKey);
  const dungeonId = dungeonService.list(inviter?.level || 1)[dungeonNumber - 1]
    ?.dungeon_id;
  if (!dungeonId)
    return ctx.interaction.reply({
      content: "Dungeon tidak tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  const invited = dungeonService.inviteDuo(inviterKey, dungeonId);
  if (!invited.success)
    return ctx.interaction.reply({
      content: `Gagal memulai dungeon: ${invited.reason}`,
      flags: MessageFlags.Ephemeral,
    });
  const resolved = resolveDiscordAction(`ldinvite:${invited.invite.id}:accept`);
  ctx.match = [
    `ldinvite:${invited.invite.id}:accept`,
    String(invited.invite.id),
    "accept",
  ];
  ctx.callbackQuery = { data: ctx.match[0] };
  return resolved.handler(ctx);
});
adapter.action(/^discord:duo:decline:(\d+)$/, async (ctx) => {
  const inviterKey = ensureDiscordIdentity(
    ctx.match[1],
    ctx.interaction.guildId,
  );
  social.disconnectPair(ctx.chat.id, inviterKey);
  return ctx.interaction.update({
    content: "Undangan party dan dungeon ditolak.",
    components: [],
  });
});
adapter.action(/^discord:shop:page:(?:prev|next):(\d+)$/, (ctx) => {
  const view = discordShopPage(ctx.chat.id, Number(ctx.match[1]));
  return ctx.interaction.update({
    embeds: [new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text)],
    components: view.components,
  });
});
adapter.action(/^discord:panel:(inv|shop)$/, (ctx) => {
  const command = ctx.match[1];
  const view =
    command === "shop"
      ? discordShopPage(ctx.chat.id, 1)
      : inventoryPage(ctx.chat.id, 1);
  return ctx.interaction.update({
    embeds: [new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text)],
    components: view.components,
  });
});
adapter.action(/^discord:inv:gearforge:(\d+)$/, (ctx) =>
  dispatchDiscordCommand(
    ctx.interaction,
    "gear",
    `/gear forge ${ctx.match[1]}`,
    true,
  ),
);
adapter.action(/^discord:inv:ore:(\d+)$/, (ctx) =>
  dispatchDiscordCommand(ctx.interaction, "ore", `/ore`, true),
);
adapter.action(/^discord:skill:learn:(\d+)$/, (ctx) =>
  dispatchDiscordCommand(
    ctx.interaction,
    "skill",
    `/skill learn ${ctx.match[1]}`,
    true,
  ),
);
adapter.action(/^discord:skill:equip:(\d+):([1-3])$/, (ctx) =>
  dispatchDiscordCommand(
    ctx.interaction,
    "skill",
    `/skill equip ${ctx.match[1]} ${ctx.match[2]}`,
    true,
  ),
);
adapter.action(
  /^discord:gear:(compare|equip|unequip|upgrade|reforge|salvage):(\d+)$/,
  (ctx) =>
    dispatchDiscordCommand(
      ctx.interaction,
      "gear",
      `/gear ${ctx.match[1]} ${ctx.match[2]}`,
      true,
    ),
);

function commandJson() {
  return COMMANDS.map(([name, description]) => {
    const c = new SlashCommandBuilder()
      .setName(name)
      .setDescription(description);
    if (name === "profile")
      c.addStringOption((o) =>
        o
          .setName("class")
          .setDescription("Pilih kelas")
          .setRequired(false)
          .addChoices(
            { name: "Ksatria", value: "ksatria" },
            { name: "Penyihir", value: "penyihir" },
            { name: "Assassin", value: "pencuri" },
          ),
      );
    else {
      c.addStringOption((o) =>
        o
          .setName("input")
          .setDescription("Argumen lama (opsional)")
          .setRequired(false)
          .setAutocomplete(true),
      );
      if (
        [
          "party",
          "dungeon",
          "duel",
          "raid",
          "bounty",
          "trade",
          "coopcampaign",
          "worldboss",
        ].includes(name)
      )
        c.addUserOption((o) =>
          o
            .setName("user")
            .setDescription("Target anggota Discord")
            .setRequired(false),
        );
      if (name === "market") {
        c.addStringOption((o) =>
          o
            .setName("action")
            .setDescription("browse, sell, buy, cancel")
            .setRequired(false)
            .addChoices(
              { name: "Browse", value: "browse" },
              { name: "Sell", value: "sell" },
              { name: "Buy", value: "buy" },
              { name: "Cancel", value: "cancel" },
            ),
        );
        c.addIntegerOption((o) =>
          o
            .setName("item")
            .setDescription("Nomor item inventory atau listing")
            .setRequired(false)
            .setMinValue(1),
        );
        c.addIntegerOption((o) =>
          o
            .setName("quantity")
            .setDescription("Jumlah item")
            .setRequired(false)
            .setMinValue(1),
        );
        c.addIntegerOption((o) =>
          o
            .setName("price")
            .setDescription("Harga per item")
            .setRequired(false)
            .setMinValue(1),
        );
      }
      if (name === "guild") {
        c.addStringOption((o) =>
          o
            .setName("action")
            .setDescription(
              "info, create, join, contribute, upgrade, leave, quest",
            )
            .setRequired(false)
            .addChoices(
              { name: "Info", value: "info" },
              { name: "Create", value: "create" },
              { name: "Join", value: "join" },
              { name: "Contribute", value: "contribute" },
              { name: "Upgrade", value: "upgrade" },
              { name: "Leave", value: "leave" },
              { name: "Quest", value: "quest" },
            ),
        );
        c.addStringOption((o) =>
          o
            .setName("value")
            .setDescription("TAG guild atau jumlah gold")
            .setRequired(false),
        );
      }
      if (name === "trade") {
        c.addStringOption((o) =>
          o
            .setName("action")
            .setDescription("offer, accept, cancel, status")
            .setRequired(false)
            .addChoices(
              { name: "Offer", value: "offer" },
              { name: "Accept", value: "accept" },
              { name: "Cancel", value: "cancel" },
              { name: "Status", value: "status" },
            ),
        );
        c.addStringOption((o) =>
          o
            .setName("type")
            .setDescription("gold atau item")
            .setRequired(false)
            .addChoices(
              { name: "Gold", value: "gold" },
              { name: "Item", value: "item" },
            ),
        );
        c.addIntegerOption((o) =>
          o
            .setName("amount")
            .setDescription("Jumlah gold/item")
            .setRequired(false)
            .setMinValue(1),
        );
        c.addIntegerOption((o) =>
          o
            .setName("trade_id")
            .setDescription("ID trade")
            .setRequired(false)
            .setMinValue(1),
        );
      }
    }
    return c.toJSON();
  });
}
async function dispatchDiscordCommand(
  interaction,
  command,
  text,
  privateReply = false,
) {
  const handler = handlers.get(command);
  if (!handler)
    return interaction.reply({
      content: "Command belum tersedia.",
      flags: MessageFlags.Ephemeral,
    });
  interaction.__discordCommandName = command;
  await interaction.deferReply(
    privateReply ? { flags: MessageFlags.Ephemeral } : {},
  );
  const ctx = ctxFor(interaction, text);
  await handler(ctx, () => {});
  await ctx.flush();
}
function resolveDiscordAction(data) {
  const exact = actions.get(data);
  if (exact) return { handler: exact, match: null };
  for (const [pattern, handler] of actions) {
    if (!(pattern instanceof RegExp)) continue;
    const match = data.match(pattern);
    if (match) return { handler, match };
  }
  return null;
}
async function handleSelectInteraction(interaction) {
  if (!interaction.isStringSelectMenu()) return;
  try {
    if (interaction.customId === "discord:inv:select") {
      const number = Number(interaction.values[0]);
      const userKey = ensureDiscordIdentity(
        interaction.user.id,
        interaction.guildId,
      );
      const item = orderInventory(getInventory(userKey))[number - 1];
      if (!item)
        return interaction.reply({
          content: "Item inventory tidak valid.",
          flags: MessageFlags.Ephemeral,
        });
      const actionButtons = [];
      if (item.category === "consumable") {
        actionButtons.push(
          new ButtonBuilder()
            .setCustomId(`discord:inv:action:use:${number}`)
            .setLabel("Use")
            .setStyle(ButtonStyle.Primary),
        );
      }
      if (["weapon", "staff", "armor", "accessory"].includes(item.category)) {
        actionButtons.push(
          new ButtonBuilder()
            .setCustomId(`discord:inv:action:equip:${number}`)
            .setLabel("Equip")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`discord:inv:gearforge:${number}`)
            .setLabel("Forge")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`discord:inv:action:salvage:${number}`)
            .setLabel("Salvage")
            .setStyle(ButtonStyle.Danger),
        );
      }
      if (item.category === "material") {
        actionButtons.push(
          new ButtonBuilder()
            .setCustomId(`discord:inv:action:refine:${number}`)
            .setLabel("Refine")
            .setStyle(ButtonStyle.Secondary),
        );
        if (ORE_CONVERSION_RATES[item.item_id]) {
          actionButtons.push(
            new ButtonBuilder()
              .setCustomId(`discord:inv:ore:${number}`)
              .setLabel("Lebur Ore")
              .setStyle(ButtonStyle.Primary),
          );
        }
      }
      actionButtons.push(
        new ButtonBuilder()
          .setCustomId(`discord:inv:action:sell:${number}`)
          .setLabel("Sell")
          .setStyle(ButtonStyle.Danger),
      );
      return interaction.reply({
        content: `Pilih aksi untuk **${item.display_name}**.`,
        flags: MessageFlags.Ephemeral,
        components: [new ActionRowBuilder().addComponents(actionButtons)],
      });
    }
    if (interaction.customId === "discord:ore:select") {
      const [number, available] = interaction.values[0].split(":").map(Number);
      if (!number || !available)
        return interaction.reply({
          content: "Material ore tidak valid.",
          flags: MessageFlags.Ephemeral,
        });
      const quantities = [
        ...new Set(
          [1, 5, 10, 25, available].filter((quantity) => quantity <= available),
        ),
      ].sort((a, b) => a - b);
      const select = new StringSelectMenuBuilder()
        .setCustomId(`discord:ore:quantity:${number}`)
        .setPlaceholder(`Pilih jumlah · tersedia ${available}`)
        .addOptions(
          quantities.map((quantity) => ({
            label:
              quantity === available
                ? `Semua (${quantity})`
                : `${quantity} buah`,
            value: String(quantity),
          })),
        );
      return interaction.reply({
        content: `Material nomor **${number}** · tersedia **${available}**.`,
        flags: MessageFlags.Ephemeral,
        components: [new ActionRowBuilder().addComponents(select)],
      });
    }
    if (interaction.customId.startsWith("discord:ore:quantity:")) {
      const number = Number(interaction.customId.split(":").pop());
      const quantity = Number(interaction.values[0]);
      return dispatchDiscordCommand(
        interaction,
        "ore",
        `/ore convert ${number} ${quantity}`,
        true,
      );
    }
    if (interaction.customId === "discord:skill:select") {
      const number = Number(interaction.values[0]);
      return interaction.reply({
        content: `Pilih aksi untuk skill ${number}.`,
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`discord:skill:learn:${number}`)
              .setLabel("Learn")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`discord:skill:equip:${number}:1`)
              .setLabel("Slot 1")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`discord:skill:equip:${number}:2`)
              .setLabel("Slot 2")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`discord:skill:equip:${number}:3`)
              .setLabel("Slot 3")
              .setStyle(ButtonStyle.Primary),
          ),
        ],
      });
    }
    if (interaction.customId === "discord:gear:select") {
      const number = Number(interaction.values[0]);
      const userKey = ensureDiscordIdentity(
        interaction.user.id,
        interaction.guildId,
      );
      const item = equipmentService.list(userKey)[number - 1];
      if (!item)
        return interaction.reply({
          content: "Gear tidak valid.",
          flags: MessageFlags.Ephemeral,
        });
      return interaction.reply({
        content: `Pilih aksi untuk **${item.display_name}**.`,
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`discord:gear:compare:${number}`)
              .setLabel("Compare")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(
                `discord:gear:${item.equipped_slot ? "unequip" : "equip"}:${number}`,
              )
              .setLabel(item.equipped_slot ? "Unequip" : "Equip")
              .setStyle(
                item.equipped_slot ? ButtonStyle.Danger : ButtonStyle.Success,
              ),
            new ButtonBuilder()
              .setCustomId(`discord:gear:upgrade:${number}`)
              .setLabel("Upgrade")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`discord:gear:reforge:${number}`)
              .setLabel("Reforge")
              .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
              .setCustomId(`discord:gear:salvage:${number}`)
              .setLabel("Salvage")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    }
    if (interaction.customId.startsWith("discord:callback-select:")) {
      const data = interaction.values[0];
      const resolved = resolveDiscordAction(data);
      if (!resolved)
        return interaction.reply({
          content: "Aksi sudah kedaluwarsa.",
          flags: MessageFlags.Ephemeral,
        });
      const ctx = ctxFor(interaction);
      ctx.callbackQuery = { data };
      ctx.match = resolved.match;
      await resolved.handler(ctx);
      await ctx.flush();
      return;
    }
    if (interaction.customId !== "discord:shop:select") return;
    const itemId = Number(interaction.values[0]);
    const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
    const catalog = item ? getCatalogItem(item.item_id) : null;
    if (!item)
      return interaction.reply({
        content: "Item shop tidak valid.",
        flags: MessageFlags.Ephemeral,
      });
    return interaction.reply({
      content: `Konfirmasi beli ${catalog?.display_name || item.item_id} seharga ${item.buy_price.toLocaleString()}g?`,
      flags: MessageFlags.Ephemeral,
      components: [
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`discord:shop:confirm:${item.id}`)
            .setLabel("Beli")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("discord:shop:cancel")
            .setLabel("Batal")
            .setStyle(ButtonStyle.Danger),
        ),
      ],
    });
  } catch (error) {
    console.error("[Discord] select interaction failed:", error.message);
    if (!interaction.replied)
      await interaction
        .reply({
          content: "Gagal membuka item shop.",
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
  }
}
client.once("clientReady", async () => {
  try {
    const rest = new REST({ version: "10" }).setToken(
      process.env.DISCORD_BOT_TOKEN,
    );
    const route = process.env.DISCORD_GUILD_ID
      ? Routes.applicationGuildCommands(
          client.user.id,
          process.env.DISCORD_GUILD_ID,
        )
      : Routes.applicationCommands(client.user.id);
    await rest.put(route, { body: commandJson() });
    console.log("[Discord] RPG penuh online sebagai " + client.user.tag);
    console.log("[Discord] " + handlers.size + " RPG handlers loaded");
  } catch (e) {
    console.error("[Discord] registration failed:", e.message);
  }
});
async function handleDiscordInteraction(interaction) {
  try {
    if (interaction.isStringSelectMenu()) {
      return handleSelectInteraction(interaction);
    }
    if (interaction.isButton() && interaction.customId === "discord:navpage:1")
      return interaction.update({
        components: discordUi.navigationRows("profile", 1),
      });
    if (interaction.isButton() && interaction.customId === "discord:navpage:2")
      return interaction.update({
        components: discordUi.navigationRows("profile", 2),
      });
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("discord:shop:item:")
    ) {
      const itemId = Number(interaction.customId.split(":").pop());
      const userKey = ensureDiscordIdentity(
        interaction.user.id,
        interaction.guildId,
      );
      const item = SHOP_ITEMS.find((entry) => entry.id === itemId);
      const catalog = item ? getCatalogItem(item.item_id) : null;
      if (!item)
        return interaction.reply({
          content: "Item shop tidak valid.",
          flags: MessageFlags.Ephemeral,
        });
      return interaction.reply({
        content:
          "Konfirmasi beli " +
          (catalog?.display_name || item.item_id) +
          " seharga " +
          item.buy_price +
          "g?",
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("discord:shop:confirm:" + item.id)
              .setLabel("Konfirmasi")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("discord:shop:cancel")
              .setLabel("Batal")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      });
    }
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("discord:shop:confirm:")
    ) {
      const itemId = Number(interaction.customId.split(":").pop());
      return dispatchDiscordCommand(interaction, "buy", "/buy " + itemId, true);
    }
    if (
      interaction.isButton() &&
      interaction.customId === "discord:shop:cancel"
    )
      return interaction.update({
        content: "Pembelian dibatalkan.",
        components: [],
      });
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("discord:inv:item:")
    ) {
      const number = Number(interaction.customId.split(":").pop());
      return interaction.reply({
        content: "Pilih aksi untuk item " + number + ".",
        flags: MessageFlags.Ephemeral,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("discord:inv:action:equip:" + number)
              .setLabel("Equip")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("discord:inv:action:use:" + number)
              .setLabel("Use")
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId("discord:inv:action:sell:" + number)
              .setLabel("Sell")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("discord:inv:action:upgrade:" + number)
              .setLabel("Upgrade")
              .setStyle(ButtonStyle.Secondary),
          ),
        ],
      });
    }
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("discord:inv:action:")
    ) {
      const parts = interaction.customId.split(":");
      return dispatchDiscordCommand(
        interaction,
        parts[3],
        "/" + parts[3] + " " + parts[4],
        true,
      );
    }
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("discord:nav:")
    ) {
      const command = interaction.customId.slice("discord:nav:".length);
      const handler = handlers.get(command);
      if (!handler)
        return interaction.reply({
          content: "Aksi navigasi belum tersedia.",
          flags: MessageFlags.Ephemeral,
        });
      interaction.__discordCommandName = command;
      await interaction.deferReply(
        PRIVATE_COMMANDS.has(command) ? { flags: MessageFlags.Ephemeral } : {},
      );
      const ctx = ctxFor(interaction, "/" + command);
      await handler(ctx, () => {});
      await ctx.flush();
      return;
    }
    if (interaction.isAutocomplete()) {
      const q = (interaction.options.getString("input") || "").toLowerCase();
      const key = ensureDiscordIdentity(
        interaction.user.id,
        interaction.guildId,
      );
      let v;
      if (["shop", "buy"].includes(interaction.commandName))
        v = SHOP_ITEMS.map((x) => ({
          name: String(x.id) + ". " + String(x.item_id),
          value: String(x.item_id),
        }));
      else v = discordAutocompleteChoices(interaction.commandName, key);
      return interaction.respond(
        v
          .filter(
            (x) =>
              x.name.toLowerCase().includes(q) ||
              x.value.toLowerCase().includes(q),
          )
          .slice(0, 25),
      );
    }
    if (
      interaction.isButton() &&
      interaction.customId.startsWith("discord:inv:page:")
    ) {
      const view = inventoryPage(
        ensureDiscordIdentity(interaction.user.id, interaction.guildId),
        Number(interaction.customId.split(":").pop()),
      );
      return interaction.update({
        embeds: [
          new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text),
        ],
        components: view.components,
      });
    }
    if (
      interaction.isButton() &&
      (interaction.customId.startsWith("discord_party_accept:") ||
        interaction.customId.startsWith("discord_party_decline:"))
    ) {
      await interaction.deferUpdate();
      const [, intendedUser, inviterDiscordId] = interaction.customId.split(":");
      if (intendedUser && intendedUser !== String(interaction.user.id))
        return interaction.editReply({
          content: "❌ Undangan ini bukan untuk akunmu.",
          components: [],
        });
      const key = ensureDiscordIdentity(
        interaction.user.id,
        interaction.guildId,
      );
      if (interaction.customId.startsWith("discord_party_accept:")) {
        const result = social.acceptInvite(key);
        return interaction.editReply({
          content: result.success
            ? "✅ Kamu bergabung ke party #" + result.partyId
            : "❌ " + result.reason,
          components: [],
        });
      }
      const inviterKey = inviterDiscordId
        ? ensureDiscordIdentity(inviterDiscordId, interaction.guildId)
        : null;
      const result = social.rejectInvite(key, inviterKey);
      return interaction.editReply({
        content: result.success
          ? "❌ Undangan party ditolak."
          : `❌ ${result.reason}`,
        components: [],
      });
    }
    if (interaction.isButton()) {
      let h = actions.get(interaction.customId);
      let match = null;
      if (!h) {
        for (const [pattern, candidate] of actions) {
          if (pattern instanceof RegExp) {
            const found = interaction.customId.match(pattern);
            if (found) {
              h = candidate;
              match = found;
              break;
            }
          }
        }
      }
      if (!h) return interaction.reply({ content: "Aksi sudah kedaluwarsa." });
      const ctx = ctxFor(interaction);
      if (match) {
        ctx.match = match;
        ctx.callbackQuery = { data: interaction.customId };
      }
      await h(ctx);
      await ctx.flush();
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const input =
      interaction.commandName === "profile"
        ? interaction.options.getString("class") || ""
        : interaction.options.getString("input") || "";
    const nativeTrade =
      interaction.commandName === "trade"
        ? {
            action: interaction.options.getString("action") || "status",
            type: interaction.options.getString("type"),
            amount: interaction.options.getInteger("amount"),
            tradeId: interaction.options.getInteger("trade_id"),
          }
        : null;
    const nativeMarket =
      interaction.commandName === "market"
        ? {
            action: interaction.options.getString("action") || "browse",
            item: interaction.options.getInteger("item"),
            quantity: interaction.options.getInteger("quantity"),
            price: interaction.options.getInteger("price"),
          }
        : null;
    const nativeGuild =
      interaction.commandName === "guild"
        ? {
            action: interaction.options.getString("action") || "info",
            value: interaction.options.getString("value"),
          }
        : null;
    const target = interaction.options.getUser("user");
    const actorKey = ensureDiscordIdentity(
      interaction.user.id,
      interaction.guildId,
    );
    const expectedChannel =
      interaction.guildId &&
      !PRIVATE_COMMANDS.has(
        interaction.commandName || interaction.__discordCommandName,
      )
        ? COMMAND_CHANNEL[interaction.commandName]
        : null;
    const wrongChannel = Boolean(
      expectedChannel && interaction.channel?.name !== `・${expectedChannel}`,
    );
    const destination = wrongChannel
      ? await resolveRpgChannel(interaction.guild, expectedChannel)
      : null;
    if (interaction.commandName === "inv") {
      const view = inventoryPage(actorKey, Number(input) || 1);
      return interaction.reply({
        embeds: [
          new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text),
        ],
        components: view.components,
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply(
      PRIVATE_COMMANDS.has(
        interaction.commandName || interaction.__discordCommandName,
      ) || wrongChannel
        ? { flags: MessageFlags.Ephemeral }
        : {},
    );
    if (wrongChannel)
      return interaction.editReply({
        content: `❌ Command ini digunakan di channel yang salah. Gunakan ${channelMention(destination || expectedChannel)}.`,
      });
    if (
      CHARACTER_REQUIRED.has(interaction.commandName) &&
      !getOrCreateUser(actorKey)
    ) {
      return interaction.editReply({
        content: "❌ Buat karakter terlebih dahulu dengan `/profile`.",
      });
    }
    const duoMatch =
      interaction.commandName === "dungeon"
        ? String(input)
            .trim()
            .match(/^duo(?:\s+(\d+))?$/i)
        : null;
    if (duoMatch && target) {
      const dungeonNumber = Number(duoMatch[1] || 1);
      const targetKeyForDuo = ensureDiscordIdentity(
        target.id,
        interaction.guildId,
      );
      if (!getOrCreateUser(targetKeyForDuo))
        return interaction.editReply("Target belum memiliki karakter RPG.");
      const dungeon = dungeonService.list(
        getOrCreateUser(actorKey)?.level || 1,
      )[dungeonNumber - 1];
      if (!dungeon)
        return interaction.editReply(
          "Nomor dungeon tidak valid. Buka `/dungeon`.",
        );
      const actorParty = social.getParty(actorKey);
      const targetParty = social.getParty(targetKeyForDuo);
      const alreadyTogether =
        actorParty &&
        targetParty &&
        actorParty.id === targetParty.id &&
        actorParty.members.length === 2;
      if (alreadyTogether) {
        const invited = dungeonService.inviteDuo(actorKey, dungeon.dungeon_id);
        if (!invited.success)
          return interaction.editReply(`Gagal mengundang: ${invited.reason}`);
        await target.send({
          content: `Dungeon duo **${invited.invite.dungeonName}** dari <@${interaction.user.id}>.`,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId(`ldinvite:${invited.invite.id}:accept`)
                .setLabel("Terima & Mulai")
                .setStyle(ButtonStyle.Success),
              new ButtonBuilder()
                .setCustomId(`ldinvite:${invited.invite.id}:decline`)
                .setLabel("Tolak")
                .setStyle(ButtonStyle.Danger),
            ),
          ],
        });
        return interaction.editReply(
          `Undangan **${invited.invite.dungeonName}** dikirim ke ${target.toString()}.`,
        );
      }
      if (targetParty || (actorParty && actorParty.members.length !== 1)) {
        return interaction.editReply(
          "Kalian sedang berada di party berbeda atau party tidak berisi tepat dua slot. Rapikan party terlebih dahulu.",
        );
      }
      if (!actorParty) {
        const created = social.createParty(actorKey);
        if (!created.success)
          return interaction.editReply(
            `Gagal membuat party: ${created.reason}`,
          );
      }
      const partyInvite = social.invite(actorKey, targetKeyForDuo);
      if (!partyInvite.success)
        return interaction.editReply(
          `Gagal mengundang partner: ${partyInvite.reason}`,
        );
      await target.send({
        content: `<@${interaction.user.id}> mengajakmu masuk party dan memainkan **${dungeon.name}**.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(
                `discord:duo:join:${interaction.user.id}:${dungeonNumber}`,
              )
              .setLabel("Terima & Mulai")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`discord:duo:decline:${interaction.user.id}`)
              .setLabel("Tolak")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      });
      return interaction.editReply(
        `Undangan party + dungeon **${dungeon.name}** dikirim ke ${target.toString()}.`,
      );
    }
    if (interaction.commandName === "profile" && input) {
      const existing = getOrCreateUser(actorKey);
      if (!existing) {
        createUser(actorKey, input);
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x22c55e)
              .setTitle("🎉 Karakter berhasil dibuat")
              .setDescription(
                "Selamat datang di RYU RPG!\n\nGunakan /alias input:NamaKamu untuk memberi nama karakter.\nSetelah itu lanjutkan dengan /guide atau /campaign.",
              )
              .addFields({
                name: "Langkah berikutnya",
                value: "1. Atur alias\n2. Buka guide\n3. Mulai campaign",
              }),
          ],
        });
      }
    }
    const targetKey = target
      ? ensureDiscordIdentity(target.id, interaction.guildId)
      : null;
    if (
      targetKey &&
      [
        "party",
        "dungeon",
        "duel",
        "raid",
        "bounty",
        "trade",
        "coopcampaign",
        "worldboss",
      ].includes(interaction.commandName)
    ) {
      activePartners.set(actorKey, targetKey);
      activePartners.set(targetKey, actorKey);
    }
    if (interaction.commandName === "shop") {
      const view = discordShopPage(actorKey, Number(input) || 1);
      return interaction.editReply({
        embeds: [
          new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text),
        ],
        components: view.components,
      });
    }
    if (
      interaction.commandName === "profile" &&
      !input &&
      getOrCreateUser(actorKey)
    ) {
      return interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x7c3aed)
            .setDescription(
              formatDiscordText(renderProfile(getOrCreateUser(actorKey))),
            ),
        ],
        components: discordUi.navigationRows("profile", 1),
      });
    }
    const h = handlers.get(interaction.commandName);
    if (!h)
      return interaction.editReply({ content: "Command belum tersedia." });
    if (nativeGuild) {
      const action = nativeGuild.action;
      let result;
      if (action === "create")
        result = social.createGuild(
          actorKey,
          nativeGuild.value,
          interaction.guild?.name || "Discord Guild",
        );
      else if (action === "join")
        result = social.joinGuild(actorKey, nativeGuild.value);
      else if (action === "contribute")
        result = social.contribute(actorKey, Number(nativeGuild.value));
      else if (action === "upgrade") result = social.upgradeGuild(actorKey);
      else if (action === "leave") result = social.leaveGuild(actorKey);
      else if (action === "quest") result = social.getGuildQuest(actorKey);
      else result = { success: true, guild: social.getGuild(actorKey) };
      if (!result.success) return interaction.editReply("❌ " + result.reason);
      const g = result.guild || social.getGuild(actorKey);
      if (action === "quest" && result.quest)
        return interaction.editReply(
          "📜 Guild quest: " +
            result.quest.current +
            "/" +
            result.quest.target +
            " gold · status " +
            result.quest.status,
        );
      return interaction.editReply(
        g
          ? "🏛️ [" +
              g.tag +
              "] " +
              g.name +
              "\nLevel " +
              g.level +
              " · Treasury " +
              g.treasury +
              "g\nAnggota " +
              g.members.length
          : "✅ Aksi guild selesai.",
      );
    }
    if (nativeMarket) {
      const userId = actorKey;
      if (nativeMarket.action === "browse") {
        const rows = marketplace.browse({ limit: 20 });
        return interaction.editReply(
          rows.length
            ? "🏪 Marketplace\\n" +
                rows
                  .map(
                    (x, i) =>
                      i +
                      1 +
                      ". " +
                      x.display_name +
                      " x" +
                      x.quantity +
                      " — " +
                      x.unit_price +
                      "g/item",
                  )
                  .join("\\n")
            : "🏪 Marketplace kosong.",
        );
      }
      const rows = marketplace.browse({ limit: 20 });
      if (nativeMarket.action === "buy" || nativeMarket.action === "cancel") {
        if (!nativeMarket.item)
          return interaction.editReply("❌ Isi nomor listing pada opsi item.");
        const listing = rows[nativeMarket.item - 1];
        if (!listing)
          return interaction.editReply("❌ Nomor listing tidak valid.");
        const result =
          nativeMarket.action === "buy"
            ? marketplace.buy(userId, listing.id)
            : marketplace.cancel(userId, listing.id);
        return interaction.editReply(
          result.success
            ? nativeMarket.action === "buy"
              ? "✅ Pembelian berhasil."
              : "✅ Listing dibatalkan."
            : "❌ " + result.reason,
        );
      }
      if (nativeMarket.action === "sell") {
        if (!nativeMarket.item || !nativeMarket.quantity || !nativeMarket.price)
          return interaction.editReply("❌ Isi item, quantity, dan price.");
        const inv = getInventory(userId);
        const item = inv[nativeMarket.item - 1];
        if (!item)
          return interaction.editReply("❌ Nomor item inventory tidak valid.");
        const result = marketplace.createListing(
          userId,
          item.item_id,
          nativeMarket.quantity,
          nativeMarket.price,
        );
        return interaction.editReply(
          result.success ? "✅ Listing dibuat." : "❌ " + result.reason,
        );
      }
    }
    if (nativeTrade) {
      const userId = actorKey;
      if (nativeTrade.action === "status") {
        const pendingTrade = directTrade.getPending(userId);
        return interaction.editReply(
          pendingTrade
            ? "🤝 Trade #" + pendingTrade.id + " pending."
            : "Tidak ada trade pending.",
        );
      }
      if (nativeTrade.action === "accept") {
        const result = directTrade.accept(userId, nativeTrade.tradeId);
        return interaction.editReply(
          result.success ? "✅ Trade selesai." : "❌ " + result.reason,
        );
      }
      if (nativeTrade.action === "cancel") {
        const result = directTrade.cancel(userId, nativeTrade.tradeId);
        return interaction.editReply(
          result.success ? "✅ Trade dibatalkan." : "❌ " + result.reason,
        );
      }
      if (nativeTrade.action === "offer") {
        if (!targetKey)
          return interaction.editReply(
            "❌ Pilih user target dengan opsi user.",
          );
        if (!nativeTrade.type || !nativeTrade.amount)
          return interaction.editReply("❌ Isi type dan amount.");
        const inv = nativeTrade.type === "item" ? getInventory(actorKey) : [];
        const item =
          nativeTrade.type === "item" ? inv[nativeTrade.amount - 1] : null;
        const offer =
          nativeTrade.type === "gold"
            ? { type: "gold", amount: nativeTrade.amount }
            : { type: "item", itemId: item?.item_id, quantity: 1 };
        if (!offer.itemId && nativeTrade.type === "item")
          return interaction.editReply("❌ Nomor item tidak valid.");
        const result = directTrade.createOffer(userId, targetKey, offer);
        return interaction.editReply(
          result.success
            ? "✅ Penawaran trade #" + result.tradeId + " dikirim."
            : "❌ " + result.reason,
        );
      }
    }
    if (
      targetKey &&
      interaction.commandName === "party" &&
      input === "invite"
    ) {
      if (!getOrCreateUser(targetKey))
        return interaction.editReply("❌ Target belum memiliki karakter RPG.");
      const party = social.getParty(actorKey) || social.createParty(actorKey);
      if (!social.getParty(actorKey))
        return interaction.editReply("❌ " + party.reason);
      const invited = social.invite(actorKey, targetKey);
      if (!invited.success)
        return interaction.editReply("❌ " + invited.reason);
      await target.send({
        content:
          "🤝 Kamu mendapat undangan party dari <@" +
          interaction.user.id +
          ">.",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`discord_party_accept:${target.id}:${interaction.user.id}`)
              .setLabel("Terima Party")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId(`discord_party_decline:${target.id}:${interaction.user.id}`)
              .setLabel("Tolak")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      });
      return interaction.editReply(
        "✅ Undangan party dikirim ke " + target.toString() + ".",
      );
    }
    if (targetKey && interaction.commandName === "dungeon" && input === "duo") {
      const party = social.getParty(actorKey) || social.createParty(actorKey);
      if (!social.getParty(actorKey))
        return interaction.editReply("❌ " + party.reason);
      const invited = dungeonService.inviteDuo(actorKey, "goblin_ruins");
      if (!invited.success)
        return interaction.editReply("❌ " + invited.reason);
      await target.send({
        content:
          "🏰 Undangan dungeon duo dari <@" +
          interaction.user.id +
          "> untuk **" +
          invited.invite.dungeonName +
          "**.",
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("ldinvite:" + invited.invite.id + ":accept")
              .setLabel("Terima & Mulai")
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId("ldinvite:" + invited.invite.id + ":decline")
              .setLabel("Tolak")
              .setStyle(ButtonStyle.Danger),
          ),
        ],
      });
      return interaction.editReply(
        "✅ Undangan dungeon duo dikirim ke " + target.toString() + ".",
      );
    }
    const ctx = ctxFor(
      interaction,
      "/" + interaction.commandName + (input ? " " + input : ""),
    );
    await h(ctx, () => {});
    await ctx.flush();
    if (!interaction.replied && !interaction.deferred)
      await interaction.reply({ content: "Selesai." });
  } catch (e) {
    console.error("[Discord] interaction failed:", e.message);
    if (!interaction.replied && !interaction.deferred)
      await interaction
        .reply({ content: "Terjadi kesalahan internal." })
        .catch(() => {});
    else
      await interaction
        .followUp({ content: "Terjadi kesalahan internal." })
        .catch(() => {});
  }
}
client.on("interactionCreate", handleDiscordInteraction);
client.on("error", (e) => console.error("[Discord] client error:", e.message));
if (!process.env.DISCORD_BOT_TOKEN)
  console.warn("[Discord] DISCORD_BOT_TOKEN belum diatur.");
else
  client.login(process.env.DISCORD_BOT_TOKEN).catch((e) => {
    console.error("[Discord] login gagal:", e.message);
    process.exitCode = 1;
  });
module.exports = { client, handlers, actions, COMMANDS };
