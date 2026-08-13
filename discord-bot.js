require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { setupRpg } = require('./src/rpg/controller');
const { ensureDiscordIdentity } = require('./src/rpg/discordIdentity');

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
    telegram:{sendMessage:async()=>null,copyMessage:async()=>null},
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
  telegram:{sendMessage:async()=>null},
};
setupRpg(adapter,{getPartnerId:()=>null,rateLimitCommand:(ctx,next)=>typeof next==='function'?next():undefined});

function commandJson() {
  return COMMANDS.map(([name,description]) => {
    const c=new SlashCommandBuilder().setName(name).setDescription(description);
    if(name==='profile') c.addStringOption(o=>o.setName('class').setDescription('Pilih kelas').setRequired(false).addChoices({name:'Ksatria',value:'ksatria'},{name:'Penyihir',value:'penyihir'},{name:'Pencuri',value:'pencuri'}));
    else c.addStringOption(o=>o.setName('input').setDescription('Argumen command').setRequired(false));
    return c.toJSON();
  });
}
client.once('ready',async()=>{try{const rest=new REST({version:'10'}).setToken(process.env.DISCORD_BOT_TOKEN);const route=process.env.DISCORD_GUILD_ID?Routes.applicationGuildCommands(client.user.id,process.env.DISCORD_GUILD_ID):Routes.applicationCommands(client.user.id);await rest.put(route,{body:commandJson()});console.log('[Discord] RPG penuh online sebagai '+client.user.tag);console.log('[Discord] '+handlers.size+' RPG handlers loaded');}catch(e){console.error('[Discord] registration failed:',e.message);}});
client.on('interactionCreate',async interaction=>{try{if(interaction.isButton()){let h=actions.get(interaction.customId); let match=null; if(!h){ for(const [pattern, candidate] of actions){ if(pattern instanceof RegExp){ const found=interaction.customId.match(pattern); if(found){h=candidate;match=found;break;} } } } if(!h)return interaction.reply({content:'Aksi sudah kedaluwarsa.'}); const ctx=ctxFor(interaction); if(match) { ctx.match=match; ctx.callbackQuery={data:interaction.customId}; } await h(ctx); await ctx.flush(); return;}if(!interaction.isChatInputCommand())return;const input=interaction.commandName==='profile'?(interaction.options.getString('class')||''):(interaction.options.getString('input')||'');const h=handlers.get(interaction.commandName);if(!h)return interaction.reply({content:'Command belum tersedia.'});await interaction.deferReply(); const ctx=ctxFor(interaction,'/'+interaction.commandName+(input?' '+input:'')); await h(ctx,()=>{}); await ctx.flush(); if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Selesai.'});}catch(e){console.error('[Discord] interaction failed:',e.message);if(!interaction.replied&&!interaction.deferred)await interaction.reply({content:'Terjadi kesalahan internal.'}).catch(()=>{});else await interaction.followUp({content:'Terjadi kesalahan internal.'}).catch(()=>{});}});
client.on('error',e=>console.error('[Discord] client error:',e.message));
if(!process.env.DISCORD_BOT_TOKEN)console.warn('[Discord] DISCORD_BOT_TOKEN belum diatur.');else client.login(process.env.DISCORD_BOT_TOKEN).catch(e=>{console.error('[Discord] login gagal:',e.message);process.exitCode=1;});
module.exports={client,handlers,actions,COMMANDS};
