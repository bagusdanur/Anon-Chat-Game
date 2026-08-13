require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { setupRpg } = require('./src/rpg/controller');
const { ensureDiscordIdentity } = require('./src/rpg/discordIdentity');
const { db } = require('./src/db');
const { createSocialService } = require('./src/rpg/services/social');
const { createLongDungeonService } = require('./src/rpg/services/longDungeon');
const { xpToNextLevel, calcStats, getInventory } = require('./src/rpg/db_rpg');
const { createDirectTradeService } = require('./src/rpg/services/directTrade');
const { createMarketplaceService } = require('./src/rpg/services/marketplace');
const directTrade = createDirectTradeService(db);
const marketplace = createMarketplaceService(db);
const social = createSocialService(db);
const dungeonService = createLongDungeonService(db, { xpToNextLevel, calcStats });
const activePartners = new Map();

const COMMANDS = [
  ['rpg','Menu utama RPG'],['guide','Panduan RPG'],['helprpg','Panduan lengkap RPG'],['profile','Profil karakter'],['alias','Alias karakter'],
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
function buttons(options) {
  const keyboard = options && options.reply_markup && options.reply_markup.inline_keyboard;
  if (!Array.isArray(keyboard)) return [];
  return keyboard.slice(0,5).map(row => new ActionRowBuilder().addComponents(row.slice(0,5).map(b => new ButtonBuilder()
    .setCustomId(String(b.callback_data || 'noop')).setLabel(String(b.text || 'Pilih').slice(0,80)).setStyle(ButtonStyle.Primary))));
}
function ctxFor(interaction, text='') {
  const key = ensureDiscordIdentity(interaction.user.id, interaction.guildId);
  let answered = interaction.replied;
  const pending = [];
  const ctx = {
    chat: { id:key }, from:{id:interaction.user.id}, message:{text, message_id:interaction.id},
    update:{update_id:interaction.id, callback_query:interaction.isButton()?{data:interaction.customId}:undefined},
    callbackQuery: interaction.isButton()?{data:interaction.customId}:undefined,
    telegram:{sendMessage:async(chatId,message,options={})=>{ const raw=String(chatId); const discordId=raw.startsWith('discord:')?raw.slice(8):null; if(!discordId)return null; const user=await client.users.fetch(discordId).catch(()=>null); if(!user)return null; return user.send({content:cleanText(message),components:buttons(options)}).catch(()=>null); },copyMessage:async()=>null},
    reply: async (message, options={}) => { const payload={content:cleanText(message),components:buttons(options)}; if(!answered){answered=true; const operation=interaction.deferred ? interaction.editReply(payload) : interaction.reply(payload); pending.push(operation); return operation;} const operation=interaction.followUp(payload); pending.push(operation); return operation; },
    editMessageText: async (message, options={}) => interaction.update({content:cleanText(message),components:buttons(options)}),
    answerCbQuery: async () => undefined,
    flush: async () => { if (pending.length) await Promise.allSettled(pending); },
  };
  return ctx;
}
const adapter = {
  command(name,...args){ handlers.set(name,args[args.length-1]); },
  action(name,...args){ actions.set(name,args[args.length-1]); },
  on(){},
  telegram:{sendMessage:async(chatId,message,options={})=>{ const raw=String(chatId); const discordId=raw.startsWith('discord:')?raw.slice(8):null; if(!discordId)return null; const user=await client.users.fetch(discordId).catch(()=>null); return user?user.send({content:cleanText(message),components:buttons(options)}).catch(()=>null):null; }},
};
setupRpg(adapter,{getPartnerId:(userId)=>activePartners.get(String(userId)) || null,rateLimitCommand:(ctx,next)=>typeof next==='function'?next():undefined});

function commandJson() {
  return COMMANDS.map(([name,description]) => {
    const c=new SlashCommandBuilder().setName(name).setDescription(description);
    if(name==='profile') c.addStringOption(o=>o.setName('class').setDescription('Pilih kelas').setRequired(false).addChoices({name:'Ksatria',value:'ksatria'},{name:'Penyihir',value:'penyihir'},{name:'Pencuri',value:'pencuri'}));
    else { c.addStringOption(o=>o.setName('input').setDescription('Argumen lama (opsional)').setRequired(false)); if(['party','dungeon','duel','raid','bounty','trade','coopcampaign','worldboss'].includes(name)) c.addUserOption(o=>o.setName('user').setDescription('Target anggota Discord').setRequired(false)); if(name==='trade') { c.addStringOption(o=>o.setName('action').setDescription('offer, accept, cancel, status').setRequired(false).addChoices({name:'Offer',value:'offer'},{name:'Accept',value:'accept'},{name:'Cancel',value:'cancel'},{name:'Status',value:'status'})); c.addStringOption(o=>o.setName('type').setDescription('gold atau item').setRequired(false).addChoices({name:'Gold',value:'gold'},{name:'Item',value:'item'})); c.addIntegerOption(o=>o.setName('amount').setDescription('Jumlah gold/item').setRequired(false).setMinValue(1)); c.addIntegerOption(o=>o.setName('trade_id').setDescription('ID trade').setRequired(false).setMinValue(1)); } }
    return c.toJSON();
  });
}
client.once('ready',async()=>{try{const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);const route=process.env.DISCORD_GUILD_ID?Routes.applicationGuildCommands(client.user.id,process.env.DISCORD_GUILD_ID):Routes.applicationCommands(client.user.id);await rest.put(route,{body:commandJson()});console.log('[Discord] RPG penuh online sebagai '+client.user.tag);console.log('[Discord] '+handlers.size+' RPG handlers loaded');}catch(e){console.error('[Discord] registration failed:',e.message);}});
client.on('interactionCreate',async interaction=>{try{if(interaction.isButton() && ['discord_party_accept','discord_party_decline'].includes(interaction.customId)){ await interaction.deferUpdate(); const key=ensureDiscordIdentity(interaction.user.id,interaction.guildId); if(interaction.customId==='discord_party_accept'){ const result=social.acceptInvite(key); return interaction.editReply({content:result.success?'✅ Kamu bergabung ke party #'+result.partyId:'❌ '+result.reason,components:[]}); } const result=social.leaveParty(key); return interaction.editReply({content:'❌ Undangan party ditolak.',components:[]}); } if(interaction.isButton()){let h=actions.get(interaction.customId); let match=null; if(!h){ for(const [pattern, candidate] of actions){ if(pattern instanceof RegExp){ const found=interaction.customId.match(pattern); if(found){h=candidate;match=found;break;} } } } if(!h)return interaction.reply({content:'Aksi sudah kedaluwarsa.'}); const ctx=ctxFor(interaction); if(match) { ctx.match=match; ctx.callbackQuery={data:interaction.customId}; } await h(ctx); await ctx.flush(); return;}if(!interaction.isChatInputCommand())return;const input=interaction.commandName==='profile'?(interaction.options.getString('class')||''):(interaction.options.getString('input')||''); const nativeTrade=interaction.commandName==='trade' ? {action:interaction.options.getString('action')||'status',type:interaction.options.getString('type'),amount:interaction.options.getInteger('amount'),tradeId:interaction.options.getInteger('trade_id')} : null; const target=interaction.options.getUser('user'); const actorKey=ensureDiscordIdentity(interaction.user.id,interaction.guildId); const targetKey=target?ensureDiscordIdentity(target.id,interaction.guildId):null; if(targetKey && ['party','dungeon','duel','raid','bounty','trade','coopcampaign','worldboss'].includes(interaction.commandName)){ activePartners.set(actorKey,targetKey); activePartners.set(targetKey,actorKey); } const h=handlers.get(interaction.commandName);if(!h)return interaction.reply({content:'Command belum tersedia.'});await interaction.deferReply(); if(nativeTrade){ const userId=actorKey; if(nativeTrade.action==='status'){ const pendingTrade=directTrade.getPending(userId); return interaction.editReply(pendingTrade ? '🤝 Trade #'+pendingTrade.id+' pending.' : 'Tidak ada trade pending.'); } if(nativeTrade.action==='accept'){ const result=directTrade.accept(userId,nativeTrade.tradeId); return interaction.editReply(result.success?'✅ Trade selesai.':'❌ '+result.reason); } if(nativeTrade.action==='cancel'){ const result=directTrade.cancel(userId,nativeTrade.tradeId); return interaction.editReply(result.success?'✅ Trade dibatalkan.':'❌ '+result.reason); } if(nativeTrade.action==='offer'){ if(!targetKey)return interaction.editReply('❌ Pilih user target dengan opsi user.'); if(!nativeTrade.type||!nativeTrade.amount)return interaction.editReply('❌ Isi type dan amount.'); const inv=nativeTrade.type==='item'?getInventory(actorKey):[]; const item=nativeTrade.type==='item'?inv[nativeTrade.amount-1]:null; const offer=nativeTrade.type==='gold'?{type:'gold',amount:nativeTrade.amount}:{type:'item',itemId:item?.item_id,quantity:1}; if(!offer.itemId&&nativeTrade.type==='item')return interaction.editReply('❌ Nomor item tidak valid.'); const result=directTrade.createOffer(userId,targetKey,offer); return interaction.editReply(result.success?'✅ Penawaran trade #'+result.tradeId+' dikirim.':'❌ '+result.reason); } } if(targetKey && interaction.commandName==='party' && input==='invite'){ const party=social.getParty(actorKey)||social.createParty(actorKey); if(!social.getParty(actorKey))return interaction.editReply('❌ '+party.reason); const invited=social.invite(actorKey,targetKey); if(!invited.success)return interaction.editReply('❌ '+invited.reason); await target.send({content:'🤝 Kamu mendapat undangan party dari <@'+interaction.user.id+'>.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('discord_party_accept').setLabel('Terima Party').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('discord_party_decline').setLabel('Tolak').setStyle(ButtonStyle.Danger))]}); return interaction.editReply('✅ Undangan party dikirim ke '+target.toString()+'.'); } if(targetKey && interaction.commandName==='dungeon' && input==='duo'){ const party=social.getParty(actorKey)||social.createParty(actorKey); if(!social.getParty(actorKey))return interaction.editReply('❌ '+party.reason); const invited=dungeonService.inviteDuo(actorKey,'goblin_ruins'); if(!invited.success)return interaction.editReply('❌ '+invited.reason); await target.send({content:'🏰 Undangan dungeon duo dari <@'+interaction.user.id+'> untuk **'+invited.invite.dungeonName+'**.',components:[new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ldinvite:'+invited.invite.id+':accept').setLabel('Terima & Mulai').setStyle(ButtonStyle.Success),new ButtonBuilder().setCustomId('ldinvite:'+invited.invite.id+':decline').setLabel('Tolak').setStyle(ButtonStyle.Danger))]}); return interaction.editReply('✅ Undangan dungeon duo dikirim ke '+target.toString()+'.'); } const ctx=ctxFor(interaction,'/'+interaction.commandName+(input?' '+input:'')); await h(ctx,()=>{}); await ctx.flush(); if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Selesai.'});}catch(e){console.error('[Discord] interaction failed:',e.message);if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Terjadi kesalahan internal.'}).catch(()=>{});else await interaction.followUp({content:'Terjadi kesalahan internal.'}).catch(()=>{});}});
client.on('error',e=>console.error('[Discord] client error:',e.message));
if(!process.env.DISCORD_BOT_TOKEN)console.warn('[Discord] DISCORD_BOT_TOKEN belum diatur.');else client.login(process.env.DISCORD_BOT_TOKEN).catch(e=>{console.error('[Discord] login gagal:',e.message);process.exitCode=1;});
module.exports={client,handlers,actions,COMMANDS};
