const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, REST, Routes,
} = require('discord.js');
const { getGuild, updateGuild } = require('./db');
const { askGemini } = require('./ai');
const { getMode } = require('./site');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Channel],
});

// Laufende Tickets: channelId -> { ownerId, history: [{role, text}], escalated }
const tickets = new Map();

const commands = [
  new SlashCommandBuilder().setName('panel').setDescription('Sendet das Ticket-Panel in diesen Kanal')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  new SlashCommandBuilder().setName('dashboard').setDescription('Link zum Helix Web-Dashboard'),
  new SlashCommandBuilder().setName('close').setDescription('Schließt das aktuelle Ticket'),
].map((c) => c.toJSON());

function panelMessage(cfg) {
  const p = cfg.panel;
  const embed = new EmbedBuilder()
    .setTitle(p.title).setDescription(p.description)
    .setColor(p.color || '#5865F2').setFooter({ text: p.footer || 'Helix' });
  const btn = new ButtonBuilder().setCustomId('helix_open').setLabel(p.buttonLabel || 'Ticket öffnen')
    .setStyle(ButtonStyle.Primary);
  if (p.buttonEmoji) btn.setEmoji(p.buttonEmoji);
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] };
}

const closeRow = () => new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('helix_close').setLabel('Ticket schließen').setEmoji('🔒').setStyle(ButtonStyle.Danger),
  new ButtonBuilder().setCustomId('helix_human').setLabel('Mensch anfordern').setEmoji('🙋').setStyle(ButtonStyle.Secondary),
);

async function openTicket(interaction) {
  const guild = interaction.guild;
  const existing = [...tickets.entries()].find(([, t]) => t.ownerId === interaction.user.id && t.guildId === guild.id);
  if (existing) return interaction.reply({ content: `Du hast schon ein offenes Ticket: <#${existing[0]}>`, ephemeral: true });

  const cfg = updateGuild(guild.id, (g) => { g.counter += 1; });
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] },
  ];
  if (cfg.supportRoleId) overwrites.push({ id: cfg.supportRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });

  const channel = await guild.channels.create({
    name: `ticket-${String(cfg.counter).padStart(4, '0')}`,
    type: ChannelType.GuildText,
    parent: cfg.ticketCategoryId || null,
    topic: `Ticket von ${interaction.user.tag} (${interaction.user.id})`,
    permissionOverwrites: overwrites,
  });

  const greeting = cfg.ai.greeting.replace('{user}', `<@${interaction.user.id}>`);
  tickets.set(channel.id, {
    guildId: guild.id, ownerId: interaction.user.id, escalated: !cfg.ai.enabled,
    history: [{ role: 'model', text: JSON.stringify({ reply: greeting }) }],
  });

  await channel.send({
    embeds: [new EmbedBuilder().setColor(cfg.panel.color).setAuthor({ name: `${cfg.ai.botName} • KI-Support` })
      .setDescription(cfg.ai.enabled ? greeting : 'Ein Teammitglied meldet sich gleich bei dir.')],
    components: [closeRow()],
  });
  await interaction.reply({ content: `✅ Dein Ticket: ${channel}`, ephemeral: true });
}

async function escalate(channel, t, cfg, result) {
  t.escalated = true;
  const cat = cfg.categories.find((c) => c.name === result?.category);
  const role = cat?.roleId || cfg.supportRoleId;
  if (cat?.roleId) await channel.permissionOverwrites.edit(cat.roleId, { ViewChannel: true, SendMessages: true }).catch(() => {});
  await channel.send({
    content: role ? `<@&${role}>` : undefined,
    embeds: [new EmbedBuilder().setColor('#FEE75C').setTitle('📨 Ticket an Team weitergeleitet')
      .addFields(
        { name: 'Kategorie', value: result?.category || 'Allgemein', inline: true },
        { name: 'User', value: `<@${t.ownerId}>`, inline: true },
        { name: 'KI-Zusammenfassung', value: result?.summary || '—' },
      )],
  });
  if (cfg.logChannelId) {
    const log = await channel.guild.channels.fetch(cfg.logChannelId).catch(() => null);
    log?.send(`📨 ${channel} eskaliert → **${result?.category || 'Allgemein'}**: ${result?.summary || ''}`);
  }
}

async function closeTicket(channel, by) {
  const cfg = getGuild(channel.guild.id);
  tickets.delete(channel.id);
  if (cfg.logChannelId) {
    const msgs = await channel.messages.fetch({ limit: 100 });
    const transcript = [...msgs.values()].reverse()
      .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content || m.embeds[0]?.description || ''}`).join('\n');
    const log = await channel.guild.channels.fetch(cfg.logChannelId).catch(() => null);
    await log?.send({ content: `🔒 ${channel.name} geschlossen von ${by}`, files: [{ attachment: Buffer.from(transcript), name: `${channel.name}.txt` }] });
  }
  await channel.send('🔒 Ticket wird in 5 Sekunden geschlossen…');
  setTimeout(() => channel.delete().catch(() => {}), 5000);
}

client.on('interactionCreate', async (i) => {
  try {
    if (i.isChatInputCommand()) {
      if (i.commandName === 'panel') {
        await i.channel.send(panelMessage(getGuild(i.guildId)));
        return i.reply({ content: 'Panel gesendet ✅', ephemeral: true });
      }
      if (i.commandName === 'dashboard') return i.reply({ content: `🌐 ${process.env.PAGES_URL || 'https://crystalsmp.github.io/helix'}`, ephemeral: true });
      if (i.commandName === 'close') {
        if (!tickets.has(i.channelId) && !i.channel.name.startsWith('ticket-')) return i.reply({ content: 'Kein Ticket-Kanal.', ephemeral: true });
        await i.reply('Schließe…');
        return closeTicket(i.channel, i.user.tag);
      }
    }
    if (i.isButton()) {
      if (i.customId === 'helix_open') return openTicket(i);
      if (i.customId === 'helix_close') { await i.deferUpdate(); return closeTicket(i.channel, i.user.tag); }
      if (i.customId === 'helix_human') {
        const t = tickets.get(i.channelId);
        if (!t || t.escalated) return i.reply({ content: 'Das Team ist bereits informiert.', ephemeral: true });
        await i.reply('Alles klar, ich hole ein Teammitglied dazu. 🙋');
        return escalate(i.channel, t, getGuild(i.guildId), { category: null, summary: 'User hat manuell einen Menschen angefordert.' });
      }
    }
  } catch (e) {
    console.error(e);
    if (i.isRepliable() && !i.replied) i.reply({ content: '❌ Fehler: ' + e.message, ephemeral: true }).catch(() => {});
  }
});

client.on('messageCreate', async (msg) => {
  if (msg.author.bot || !msg.guild) return;
  const t = tickets.get(msg.channelId);
  if (!t || t.escalated || msg.author.id !== t.ownerId) return;

  const cfg = getGuild(msg.guild.id);
  // Status "KI pausiert" oder Wartung: direkt ans Team
  if (getMode().ai === false) {
    await msg.channel.send('⚠️ Die KI ist gerade pausiert – ich leite dich direkt an das Team weiter.');
    return escalate(msg.channel, t, cfg, { summary: msg.content.slice(0, 300) });
  }
  t.history.push({ role: 'user', text: msg.content.slice(0, 2000) });
  await msg.channel.sendTyping();
  try {
    const result = await askGemini(cfg, msg.guild.name, t.history.slice(-20));
    t.history.push({ role: 'model', text: JSON.stringify(result) });
    await msg.channel.send({
      embeds: [new EmbedBuilder().setColor(cfg.panel.color).setAuthor({ name: `${cfg.ai.botName} • KI-Support` }).setDescription(result.reply)],
    });
    if (result.escalate) await escalate(msg.channel, t, cfg, result);
  } catch (e) {
    console.error(e);
    await msg.channel.send('⚠️ Die KI ist gerade nicht erreichbar – ich leite dich an das Team weiter.');
    await escalate(msg.channel, t, cfg, { summary: 'KI-Fehler, automatische Weiterleitung.' });
  }
});

client.once('ready', async () => {
  console.log(`🤖 Helix online als ${client.user.tag} auf ${client.guilds.cache.size} Servern`);
  await new REST().setToken(process.env.DISCORD_TOKEN).put(Routes.applicationCommands(client.user.id), { body: commands });
});

module.exports = { client, panelMessage };
