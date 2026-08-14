require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const { setupRpg } = require('./src/rpg/controller');
const { ensureDiscordIdentity } = require('./src/rpg/discordIdentity');
const { db } = require('./src/db');
const { createSocialService } = require('./src/rpg/services/social');
const { createLongDungeonService } = require('./src/rpg/services/longDungeon');
const { xpToNextLevel, calcStats, getInventory, getOrCreateUser, createUser, getCatalogItem } = require('./src/rpg/db_rpg');
const { createDirectTradeService } = require('./src/rpg/services/directTrade');
const { createMarketplaceService } = require('./src/rpg/services/marketplace');
const { SHOP_ITEMS } = require('./src/rpg/economy');
const { renderProfile } = require('./src/rpg/profile');
const discordUi = require('./src/rpg/discordUi');
const { orderInventory } = require('./src/rpg/inputResolvers');
const directTrade = createDirectTradeService(db);
const marketplace = createMarketplaceService(db);
const social = createSocialService(db);
const dungeonService = createLongDungeonService(db, { xpToNextLevel, calcStats });
const activePartners = new Map();
const DISCORD_PAGE_SIZE = 8;
const PRIVATE_COMMANDS = new Set(['profile','alias','inv','gear','skill','shop','buy','sell','use','craft','market','trade','equip','unequip','upgrade','refine','salvage','daily']);
const RPG_CHANNELS = {
  'rpg-start': ['rpg','profile','alias'],
  'rpg-story': ['world','travel','campaign','quest','season'],
  'rpg-explore': ['explore','gather','mine','fish','hunt','profession','catalog'],
  'rpg-dungeon': ['dungeon','adventure','coop','raid','bounty','tower','worldboss'],
  'rpg-market': ['shop','buy','sell','craft','market','trade','salvage','refine','ore'],
  'rpg-guild': ['party','guild','duel','rank','achievement','collection'],
  'rpg-help': ['guide','helprpg','rpghelp','bantuanrpg'],
};
const COMMAND_CHANNEL = Object.fromEntries(Object.entries(RPG_CHANNELS).flatMap(([channel,commands])=>commands.map(command=>[command,channel])));
const CHARACTER_REQUIRED = new Set(['campaign','explore','dungeon','adventure','party','coop','guild','duel','worldboss','raid','bounty','coopcampaign','tower','quest','hunt','fish','mine','profession','gather','shop','buy','sell','use','craft','market','trade','salvage','refine','equip','unequip','upgrade','ore','daily','alias']);
async function resolveRpgChannel(guild, channelName) {
  if (!guild) return null;
  const channels = await guild.channels.fetch();
  return channels.find(channel => channel && channel.name === `・${channelName}` && channel.isTextBased()) || null;
}
function channelMention(channel) { return channel ? `<#${channel.id}>` : `#・${channel}`; }
function discordPageButtons(prefix, page, totalPages) {
  return [discordUi.paginationRow(prefix, page, totalPages)];
}
function inventoryPage(userId, page = 1) {
  const items = orderInventory(getInventory(userId));
  const totalPages = Math.max(1, Math.ceil(items.length / DISCORD_PAGE_SIZE));
  const safePage = Math.min(totalPages, Math.max(1, page));
  const rows = items.slice((safePage - 1) * DISCORD_PAGE_SIZE, safePage * DISCORD_PAGE_SIZE);
  const text = rows.length ? rows.map((item, index) => `${(safePage - 1) * DISCORD_PAGE_SIZE + index + 1}. ${item.display_name} x${item.quantity}${item.upgrade_tier ? ` (+${item.upgrade_tier})` : ''}`).join('\n') : 'Inventory kosong.';
  return { text: `Inventory\n\n${text}\n\nPage ${safePage}/${totalPages}`, components: rows.length ? discordPageButtons('discord:inv', safePage, totalPages) : [] };
}
function discordShopPage(userId, page = 1) {
  const user = getOrCreateUser(userId);
  const sections = [...new Set(SHOP_ITEMS.map(item => item.section))];
  const safePage = Math.min(sections.length, Math.max(1, page));
  const section = sections[safePage - 1];
  const items = SHOP_ITEMS.filter(item => item.section === section);
  const lines = items.map(item => {
    const catalog = getCatalogItem(item.item_id);
    const locked = (user?.level || 1) < (item.min_level || 1) ? ` · Lv.${item.min_level}` : '';
    return `[${item.id}] ${catalog?.display_name || item.item_id} — ${item.buy_price}g${locked}`;
  }).join('\n');
  const buttons = items.map(item => new ButtonBuilder().setCustomId(`discord:shop:item:${item.id}`).setLabel(`Beli ${item.id}`).setStyle(ButtonStyle.Success));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 5) rows.push(new ActionRowBuilder().addComponents(buttons.slice(i, i + 5)));
  rows.push(...discordUi.navigationRows('shop', 1));
  return { text: `TOKO (SHOP)\nSaldo: ${user?.gold || 0}g\n\n${lines}\n\nHalaman ${safePage}/${sections.length}`, components: rows.slice(0, 5) };
}const COMMANDS = [
  ['rpg','Menu utama RPG'],['guide','Panduan RPG'],['helprpg','Panduan lengkap RPG'],['rpghelp','Alias panduan RPG'],['bantuanrpg','Alias panduan RPG'],['profile','Profil karakter'],['alias','Alias karakter'],
  ['world','Dunia RPG'],['travel','Pindah region'],['campaign','Campaign'],['explore','Eksplorasi'],['skill','Skill tree'],['build','Build'],['gear','Equipment'],
  ['dungeon','Dungeon'],['adventure','Adventure'],['party','Party'],['coop','Co-op'],['guild','Guild'],['duel','PvP Duel'],['worldboss','World Boss'],
  ['raid','Raid'],['bounty','Bounty'],['coopcampaign','Campaign co-op'],['tower','Tower'],['season','Season'],['rank','Leaderboard'],['achievement','Achievement'],
  ['collection','Koleksi'],['quest','Quest'],['hunt','Hunt'],['fish','Fishing'],['mine','Mining'],['profession','Profesi'],['gather','Gathering'],
  ['catalog','Katalog'],['inv','Inventory'],['shop','Shop'],['buy','Beli'],['sell','Jual'],['use','Gunakan'],['craft','Crafting'],['market','Marketplace'],
  ['trade','Trade'],['salvage','Salvage'],['refine','Refine'],['equip','Equip'],['unequip','Unequip'],['upgrade','Upgrade'],['ore','Ore'],['daily','Daily'],
];
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const handlers = new Map();
const actions = new Map();

function cleanText(value) {
  return String(value).replace(/<b>(.*?)<\/b>/gis, '**$1**').replace(/<strong>(.*?)<\/strong>/gis, '**$1**').replace(/<i>(.*?)<\/i>/gis, '*$1*').replace(/<em>(.*?)<\/em>/gis, '*$1*').replace(/<code>(.*?)<\/code>/gis, '`$1`').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}
function formatDiscordText(value) {
  let text=cleanText(value).replace(/\r/g,'');
  text=text.replace(/\n{3,}/g,'\n\n');
  return text.trim();
}
function splitDiscordText(value, limit=1900) {
  const text=formatDiscordText(value); if(text.length<=limit)return [text];
  const chunks=[]; let current='';
  for(const line of text.split('\n')) {
    if((current+'\n'+line).trim().length>limit && current){ chunks.push(current.trim()); current=''; }
    if(line.length>limit){ for(let i=0;i<line.length;i+=limit){ if(current){chunks.push(current.trim()); current='';} chunks.push(line.slice(i,i+limit)); } }
    else current+=(current?'\n':'')+line;
  }
  if(current.trim())chunks.push(current.trim()); return chunks;
}
function discordPayloads(message, options={}, privateReply=false, command='profile') {
  const chunks=splitDiscordText(message);
  const active = ['profile','inv','shop','gear','skill','campaign','dungeon','party','guild','guide'].includes(command) ? command : 'profile';
  return chunks.map((content,index)=>{
    const actionRows = index === chunks.length - 1 ? buttons(options) : [];
    const navigation = index === chunks.length - 1 ? discordUi.navigationRows(active, 1) : [];
    return { embeds:[new EmbedBuilder().setColor(0x7c3aed).setDescription(content)], components: actionRows.length + navigation.length <= 5 ? [...actionRows, ...navigation] : actionRows, ...(privateReply?{flags:MessageFlags.Ephemeral}: {}) };
  });
}async function sendDiscordUser(user,message,options={}) {
  let result=null; for(const payload of discordPayloads(message,options)) result=await user.send(payload); return result;
}function buttons(options) {
  const keyboard = options && options.reply_markup && options.reply_markup.inline_keyboard;
  if (!Array.isArray(keyboard)) return [];
  return keyboard.slice(0,5).map(row => new ActionRowBuilder().addComponents(row.slice(0,5).map(b => new ButtonBuilder()
    .setCustomId(String(b.callback_data || 'noop').slice(0,100)).setLabel(String(b.text || 'Pilih').slice(0,80)).setStyle((/tolak|cancel|batal|leave|keluar|hapus|reject/i.test(String(b.text))?ButtonStyle.Danger:(/terima|accept|mulai|lanjut|pilih|beli|buy|gunakan|equip|upgrade/i.test(String(b.text))?ButtonStyle.Success:(/kembali|prev|next|halaman|guide|info/i.test(String(b.text))?ButtonStyle.Secondary:ButtonStyle.Primary)))))));
}
function ctxFor(interaction, text='') {
  const key = ensureDiscordIdentity(interaction.user.id, interaction.guildId);
  let answered = interaction.replied;
  const pending = [];
  const ctx = {
    chat: { id:key }, from:{id:interaction.user.id}, message:{text, message_id:interaction.id},
    update:{update_id:interaction.id, callback_query:interaction.isButton()?{data:interaction.customId}:undefined},
    callbackQuery: interaction.isButton()?{data:interaction.customId}:undefined,
    telegram:{sendMessage:async(chatId,message,options={})=>{ const raw=String(chatId); const discordId=raw.startsWith('discord:')?raw.slice(8):null; if(!discordId)return null; const user=await client.users.fetch(discordId).catch(()=>null); if(!user)return null; return sendDiscordUser(user,message,options).catch(()=>null); },copyMessage:async()=>null},
    reply: async (message, options={}) => { const payloads=discordPayloads(message,options,PRIVATE_COMMANDS.has(interaction.commandName || interaction.__discordCommandName),interaction.commandName || interaction.__discordCommandName); if(!answered){answered=true; const first=interaction.deferred ? interaction.editReply(payloads[0]) : interaction.reply(payloads[0]); pending.push(first); for(const payload of payloads.slice(1))pending.push(first.then(()=>interaction.followUp(payload))); return first;} let operation=interaction.followUp(payloads[0]); pending.push(operation); for(const payload of payloads.slice(1))pending.push(operation.then(()=>interaction.followUp(payload))); return operation; },
    editMessageText: async (message, options={}) => { answered=true; const payloads=discordPayloads(message,options,PRIVATE_COMMANDS.has(interaction.commandName || interaction.__discordCommandName),interaction.commandName || interaction.__discordCommandName); const updated=await interaction.update(payloads[0]); for(const payload of payloads.slice(1))await interaction.followUp(payload); return updated; },
    answerCbQuery: async () => undefined,
    flush: async () => { if (pending.length) await Promise.allSettled(pending); },
  };
  return ctx;
}
const adapter = {
  command(name,...args){ const handler=args[args.length-1]; for(const commandName of (Array.isArray(name)?name:[name])) handlers.set(commandName,handler); },
  action(name,...args){ actions.set(name,args[args.length-1]); },
  on(){},
  telegram:{sendMessage:async(chatId,message,options={})=>{ const raw=String(chatId); const discordId=raw.startsWith('discord:')?raw.slice(8):null; if(!discordId)return null; const user=await client.users.fetch(discordId).catch(()=>null); return user?sendDiscordUser(user,message,options).catch(()=>null):null; }},
};
setupRpg(adapter,{getPartnerId:(userId)=>activePartners.get(String(userId)) || null,rateLimitCommand:(ctx,next)=>typeof next==='function'?next():undefined});

function commandJson() {
  return COMMANDS.map(([name,description]) => {
    const c=new SlashCommandBuilder().setName(name).setDescription(description);
    if(name==='profile') c.addStringOption(o=>o.setName('class').setDescription('Pilih kelas').setRequired(false).addChoices({name:'Ksatria',value:'ksatria'},{name:'Penyihir',value:'penyihir'},{name:'Assassin',value:'pencuri'}));
    else { c.addStringOption(o=>o.setName('input').setDescription('Argumen lama (opsional)').setRequired(false).setAutocomplete(true)); if(['party','dungeon','duel','raid','bounty','trade','coopcampaign','worldboss'].includes(name)) c.addUserOption(o=>o.setName('user').setDescription('Target anggota Discord').setRequired(false)); if(name==='market') { c.addStringOption(o=>o.setName('action').setDescription('browse, sell, buy, cancel').setRequired(false).addChoices({name:'Browse',value:'browse'},{name:'Sell',value:'sell'},{name:'Buy',value:'buy'},{name:'Cancel',value:'cancel'})); c.addIntegerOption(o=>o.setName('item').setDescription('Nomor item inventory atau listing').setRequired(false).setMinValue(1)); c.addIntegerOption(o=>o.setName('quantity').setDescription('Jumlah item').setRequired(false).setMinValue(1)); c.addIntegerOption(o=>o.setName('price').setDescription('Harga per item').setRequired(false).setMinValue(1)); } if(name==='guild') { c.addStringOption(o=>o.setName('action').setDescription('info, create, join, contribute, upgrade, leave, quest').setRequired(false).addChoices({name:'Info',value:'info'},{name:'Create',value:'create'},{name:'Join',value:'join'},{name:'Contribute',value:'contribute'},{name:'Upgrade',value:'upgrade'},{name:'Leave',value:'leave'},{name:'Quest',value:'quest'})); c.addStringOption(o=>o.setName('value').setDescription('TAG guild atau jumlah gold').setRequired(false)); } if(name==='trade') { c.addStringOption(o=>o.setName('action').setDescription('offer, accept, cancel, status').setRequired(false).addChoices({name:'Offer',value:'offer'},{name:'Accept',value:'accept'},{name:'Cancel',value:'cancel'},{name:'Status',value:'status'})); c.addStringOption(o=>o.setName('type').setDescription('gold atau item').setRequired(false).addChoices({name:'Gold',value:'gold'},{name:'Item',value:'item'})); c.addIntegerOption(o=>o.setName('amount').setDescription('Jumlah gold/item').setRequired(false).setMinValue(1)); c.addIntegerOption(o=>o.setName('trade_id').setDescription('ID trade').setRequired(false).setMinValue(1)); } }
    return c.toJSON();
  });
}
async function dispatchDiscordCommand(interaction, command, text, privateReply = false) {
  const handler = handlers.get(command);
  if (!handler) return interaction.reply({ content: 'Command belum tersedia.', flags: MessageFlags.Ephemeral });
  interaction.__discordCommandName = command;
  await interaction.deferReply(privateReply ? { flags: MessageFlags.Ephemeral } : {});
  const ctx = ctxFor(interaction, text);
  await handler(ctx, () => {});
  await ctx.flush();
}client.once('clientReady',async()=>{try{const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);const route=process.env.DISCORD_GUILD_ID?Routes.applicationGuildCommands(client.user.id,process.env.DISCORD_GUILD_ID):Routes.applicationCommands(client.user.id);await rest.put(route,{body:commandJson()});console.log('[Discord] RPG penuh online sebagai '+client.user.tag);console.log('[Discord] '+handlers.size+' RPG handlers loaded');}catch(e){console.error('[Discord] registration failed:',e.message);}});
client.on('interactionCreate',async interaction=>{try{if (interaction.isButton() && interaction.customId === 'discord:navpage:1') return interaction.update({components:discordUi.navigationRows('profile',1)}); if (interaction.isButton() && interaction.customId === 'discord:navpage:2') return interaction.update({components:discordUi.navigationRows('profile',2)}); if (interaction.isButton() && interaction.customId.startsWith('discord:shop:item:')) { const itemId=Number(interaction.customId.split(':').pop()); const userKey=ensureDiscordIdentity(interaction.user.id,interaction.guildId); const item=SHOP_ITEMS.find(entry=>entry.id===itemId); const catalog=item?getCatalogItem(item.item_id):null; if(!item)return interaction.reply({content:'Item shop tidak valid.',flags:MessageFlags.Ephemeral}); return interaction.reply({content:'Konfirmasi beli '+(catalog?.display_name||item.item_id)+' seharga '+item.buy_price+'g?',flags:MessageFlags.Ephemeral,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('discord:shop:confirm:'+item.id).setLabel('Konfirmasi').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('discord:shop:cancel').setLabel('Batal').setStyle(ButtonStyle.Danger))]}); } if (interaction.isButton() && interaction.customId.startsWith('discord:shop:confirm:')) { const itemId=Number(interaction.customId.split(':').pop()); return dispatchDiscordCommand(interaction,'buy','/buy '+itemId,true); } if (interaction.isButton() && interaction.customId === 'discord:shop:cancel') return interaction.update({content:'Pembelian dibatalkan.',components:[]}); if (interaction.isButton() && interaction.customId.startsWith('discord:inv:item:')) { const number=Number(interaction.customId.split(':').pop()); return interaction.reply({content:'Pilih aksi untuk item '+number+'.',flags:MessageFlags.Ephemeral,components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('discord:inv:action:equip:'+number).setLabel('Equip').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('discord:inv:action:use:'+number).setLabel('Use').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('discord:inv:action:sell:'+number).setLabel('Sell').setStyle(ButtonStyle.Danger),new ButtonBuilder().setCustomId('discord:inv:action:upgrade:'+number).setLabel('Upgrade').setStyle(ButtonStyle.Secondary))]}); } if (interaction.isButton() && interaction.customId.startsWith('discord:inv:action:')) { const parts=interaction.customId.split(':'); return dispatchDiscordCommand(interaction,parts[3],'/'+parts[3]+' '+parts[4],true); } if (interaction.isButton() && interaction.customId.startsWith('discord:nav:')) { const command=interaction.customId.slice('discord:nav:'.length); const handler=handlers.get(command); if(!handler)return interaction.reply({content:'Aksi navigasi belum tersedia.',flags:MessageFlags.Ephemeral}); interaction.__discordCommandName=command; await interaction.deferReply(PRIVATE_COMMANDS.has(command)?{flags:MessageFlags.Ephemeral}:{}); const ctx=ctxFor(interaction,'/'+command); await handler(ctx,()=>{}); await ctx.flush(); return; } if (interaction.isAutocomplete()) { const q=(interaction.options.getString('input')||'').toLowerCase(); const key=ensureDiscordIdentity(interaction.user.id,interaction.guildId); let v=[]; if(['shop','buy'].includes(interaction.commandName)) v=SHOP_ITEMS.map(x=>({name:String(x.id)+'. '+String(x.item_id),value:String(x.item_id)})); else if(['inv','use','equip','sell'].includes(interaction.commandName)) v=getInventory(key).map((x,i)=>({name:String(i+1)+'. '+x.display_name+' x'+x.quantity,value:String(i+1)})); return interaction.respond(v.filter(x=>x.name.toLowerCase().includes(q)||x.value.toLowerCase().includes(q)).slice(0,25)); } if(interaction.isButton() && interaction.customId.startsWith('discord:inv:page:')) { const view=inventoryPage(ensureDiscordIdentity(interaction.user.id,interaction.guildId),Number(interaction.customId.split(':').pop())); return interaction.update({embeds:[new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text)],components:view.components}); } if(interaction.isButton() && (interaction.customId.startsWith('discord_party_accept:') || interaction.customId.startsWith('discord_party_decline:'))){ await interaction.deferUpdate(); const inviteOwner=interaction.customId.split(':')[1]; if(inviteOwner && inviteOwner!==String(interaction.user.id)) return interaction.editReply({content:'❌ Undangan ini bukan untuk akunmu.',components:[]}); const key=ensureDiscordIdentity(interaction.user.id,interaction.guildId); if(interaction.customId.startsWith('discord_party_accept:')){ const result=social.acceptInvite(key); return interaction.editReply({content:result.success?'✅ Kamu bergabung ke party #'+result.partyId:'❌ '+result.reason,components:[]}); } const result=social.leaveParty(key); return interaction.editReply({content:'❌ Undangan party ditolak.',components:[]}); } if(interaction.isButton()){let h=actions.get(interaction.customId); let match=null; if(!h){ for(const [pattern, candidate] of actions){ if(pattern instanceof RegExp){ const found=interaction.customId.match(pattern); if(found){h=candidate;match=found;break;} } } } if(!h)return interaction.reply({content:'Aksi sudah kedaluwarsa.'}); const ctx=ctxFor(interaction); if(match) { ctx.match=match; ctx.callbackQuery={data:interaction.customId}; } await h(ctx); await ctx.flush(); return;}if(!interaction.isChatInputCommand())return;const input=interaction.commandName==='profile'?(interaction.options.getString('class')||''):(interaction.options.getString('input')||''); const nativeTrade=interaction.commandName==='trade' ? {action:interaction.options.getString('action')||'status',type:interaction.options.getString('type'),amount:interaction.options.getInteger('amount'),tradeId:interaction.options.getInteger('trade_id')} : null; const nativeMarket=interaction.commandName==='market' ? {action:interaction.options.getString('action')||'browse',item:interaction.options.getInteger('item'),quantity:interaction.options.getInteger('quantity'),price:interaction.options.getInteger('price')} : null; const nativeGuild=interaction.commandName==='guild' ? {action:interaction.options.getString('action')||'info',value:interaction.options.getString('value')} : null; const target=interaction.options.getUser('user'); const actorKey=ensureDiscordIdentity(interaction.user.id,interaction.guildId);
    const expectedChannel = interaction.guildId && !PRIVATE_COMMANDS.has(interaction.commandName || interaction.__discordCommandName) ? COMMAND_CHANNEL[interaction.commandName] : null;
    const wrongChannel = Boolean(expectedChannel && interaction.channel?.name !== `・${expectedChannel}`);
    const destination = wrongChannel ? await resolveRpgChannel(interaction.guild, expectedChannel) : null;
    if (interaction.commandName === 'inv') {
      const view = inventoryPage(actorKey, Number(input) || 1);
      return interaction.reply({
        embeds: [new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text)],
        components: view.components,
        flags: MessageFlags.Ephemeral,
      });
    }
    await interaction.deferReply((PRIVATE_COMMANDS.has(interaction.commandName || interaction.__discordCommandName) || wrongChannel)?{flags:MessageFlags.Ephemeral}:{});
    if (wrongChannel) return interaction.editReply({content:`❌ Command ini digunakan di channel yang salah. Gunakan ${channelMention(destination || expectedChannel)}.`});
    if (CHARACTER_REQUIRED.has(interaction.commandName) && !getOrCreateUser(actorKey)) {
      return interaction.editReply({content:'❌ Buat karakter terlebih dahulu dengan `/profile`.'});
    }
    if(interaction.commandName==='profile' && input){ const existing=getOrCreateUser(actorKey); if(!existing){ createUser(actorKey,input); return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x22c55e).setTitle('🎉 Karakter berhasil dibuat').setDescription('Selamat datang di RYU RPG!\n\nGunakan /alias input:NamaKamu untuk memberi nama karakter.\nSetelah itu lanjutkan dengan /guide atau /campaign.').addFields({name:'Langkah berikutnya',value:'1. Atur alias\n2. Buka guide\n3. Mulai campaign'})]}); } } const targetKey=target?ensureDiscordIdentity(target.id,interaction.guildId):null; if(targetKey && ['party','dungeon','duel','raid','bounty','trade','coopcampaign','worldboss'].includes(interaction.commandName)){ activePartners.set(actorKey,targetKey); activePartners.set(targetKey,actorKey); } if (interaction.commandName === 'shop') { const view=discordShopPage(actorKey, Number(input)||1); return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x7c3aed).setDescription(view.text)],components:view.components}); } if (interaction.commandName === 'profile' && !input && getOrCreateUser(actorKey)) { return interaction.editReply({embeds:[new EmbedBuilder().setColor(0x7c3aed).setDescription(formatDiscordText(renderProfile(getOrCreateUser(actorKey))))],components:discordUi.navigationRows('profile',1)}); } const h=handlers.get(interaction.commandName);if(!h)return interaction.editReply({content:'Command belum tersedia.'}); if(nativeGuild){ const action=nativeGuild.action; let result; if(action==='create') result=social.createGuild(actorKey,nativeGuild.value,interaction.guild?.name||'Discord Guild'); else if(action==='join') result=social.joinGuild(actorKey,nativeGuild.value); else if(action==='contribute') result=social.contribute(actorKey,Number(nativeGuild.value)); else if(action==='upgrade') result=social.upgradeGuild(actorKey); else if(action==='leave') result=social.leaveGuild(actorKey); else if(action==='quest') result=social.getGuildQuest(actorKey); else result={success:true,guild:social.getGuild(actorKey)}; if(!result.success)return interaction.editReply('❌ '+result.reason); const g=result.guild||social.getGuild(actorKey); if(action==='quest'&&result.quest)return interaction.editReply('📜 Guild quest: '+result.quest.current+'/'+result.quest.target+' gold · status '+result.quest.status); return interaction.editReply(g?'🏛️ ['+g.tag+'] '+g.name+'\nLevel '+g.level+' · Treasury '+g.treasury+'g\nAnggota '+g.members.length:'✅ Aksi guild selesai.'); } if(nativeMarket){ const userId=actorKey; if(nativeMarket.action==='browse'){ const rows=marketplace.browse({limit:20}); return interaction.editReply(rows.length?('🏪 Marketplace\\n'+rows.map((x,i)=>(i+1)+'. '+x.display_name+' x'+x.quantity+' — '+x.unit_price+'g/item').join('\\n')):'🏪 Marketplace kosong.'); } const rows=marketplace.browse({limit:20}); if(nativeMarket.action==='buy'||nativeMarket.action==='cancel'){ if(!nativeMarket.item)return interaction.editReply('❌ Isi nomor listing pada opsi item.'); const listing=rows[nativeMarket.item-1]; if(!listing)return interaction.editReply('❌ Nomor listing tidak valid.'); const result=nativeMarket.action==='buy'?marketplace.buy(userId,listing.id):marketplace.cancel(userId,listing.id); return interaction.editReply(result.success?(nativeMarket.action==='buy'?'✅ Pembelian berhasil.':'✅ Listing dibatalkan.'):'❌ '+result.reason); } if(nativeMarket.action==='sell'){ if(!nativeMarket.item||!nativeMarket.quantity||!nativeMarket.price)return interaction.editReply('❌ Isi item, quantity, dan price.'); const inv=getInventory(userId); const item=inv[nativeMarket.item-1]; if(!item)return interaction.editReply('❌ Nomor item inventory tidak valid.'); const result=marketplace.createListing(userId,item.item_id,nativeMarket.quantity,nativeMarket.price); return interaction.editReply(result.success?'✅ Listing dibuat.':'❌ '+result.reason); } } if(nativeTrade){ const userId=actorKey; if(nativeTrade.action==='status'){ const pendingTrade=directTrade.getPending(userId); return interaction.editReply(pendingTrade ? '🤝 Trade #'+pendingTrade.id+' pending.' : 'Tidak ada trade pending.'); } if(nativeTrade.action==='accept'){ const result=directTrade.accept(userId,nativeTrade.tradeId); return interaction.editReply(result.success?'✅ Trade selesai.':'❌ '+result.reason); } if(nativeTrade.action==='cancel'){ const result=directTrade.cancel(userId,nativeTrade.tradeId); return interaction.editReply(result.success?'✅ Trade dibatalkan.':'❌ '+result.reason); } if(nativeTrade.action==='offer'){ if(!targetKey)return interaction.editReply('❌ Pilih user target dengan opsi user.'); if(!nativeTrade.type||!nativeTrade.amount)return interaction.editReply('❌ Isi type dan amount.'); const inv=nativeTrade.type==='item'?getInventory(actorKey):[]; const item=nativeTrade.type==='item'?inv[nativeTrade.amount-1]:null; const offer=nativeTrade.type==='gold'?{type:'gold',amount:nativeTrade.amount}:{type:'item',itemId:item?.item_id,quantity:1}; if(!offer.itemId&&nativeTrade.type==='item')return interaction.editReply('❌ Nomor item tidak valid.'); const result=directTrade.createOffer(userId,targetKey,offer); return interaction.editReply(result.success?'✅ Penawaran trade #'+result.tradeId+' dikirim.':'❌ '+result.reason); } } if(targetKey && interaction.commandName==='party' && input==='invite'){ if(!getOrCreateUser(targetKey))return interaction.editReply('❌ Target belum memiliki karakter RPG.'); const party=social.getParty(actorKey)||social.createParty(actorKey); if(!social.getParty(actorKey))return interaction.editReply('❌ '+party.reason); const invited=social.invite(actorKey,targetKey); if(!invited.success)return interaction.editReply('❌ '+invited.reason); await target.send({content:'🤝 Kamu mendapat undangan party dari <@'+interaction.user.id+'>.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('discord_party_accept:'+target.id).setLabel('Terima Party').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('discord_party_decline:'+target.id).setLabel('Tolak').setStyle(ButtonStyle.Danger))]}); return interaction.editReply('✅ Undangan party dikirim ke '+target.toString()+'.'); } if(targetKey && interaction.commandName==='dungeon' && input==='duo'){ const party=social.getParty(actorKey)||social.createParty(actorKey); if(!social.getParty(actorKey))return interaction.editReply('❌ '+party.reason); const invited=dungeonService.inviteDuo(actorKey,'goblin_ruins'); if(!invited.success)return interaction.editReply('❌ '+invited.reason); await target.send({content:'🏰 Undangan dungeon duo dari <@'+interaction.user.id+'> untuk **'+invited.invite.dungeonName+'**.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ldinvite:'+invited.invite.id+':accept').setLabel('Terima & Mulai').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('ldinvite:'+invited.invite.id+':decline').setLabel('Tolak').setStyle(ButtonStyle.Danger))]}); return interaction.editReply('✅ Undangan dungeon duo dikirim ke '+target.toString()+'.'); } const ctx=ctxFor(interaction,'/'+interaction.commandName+(input?' '+input:'')); await h(ctx,()=>{}); await ctx.flush(); if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Selesai.'});}catch(e){console.error('[Discord] interaction failed:',e.message);if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Terjadi kesalahan internal.'}).catch(()=>{});else await interaction.followUp({content:'Terjadi kesalahan internal.'}).catch(()=>{});}});
client.on('error',e=>console.error('[Discord] client error:',e.message));
if(!process.env.DISCORD_BOT_TOKEN)console.warn('[Discord] DISCORD_BOT_TOKEN belum diatur.');else client.login(process.env.DISCORD_BOT_TOKEN).catch(e=>{console.error('[Discord] login gagal:',e.message);process.exitCode=1;});
module.exports={client,handlers,actions,COMMANDS};
