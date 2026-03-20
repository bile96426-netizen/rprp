const {
  Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes,
  PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const fetch = require('node-fetch'); // v2 — CommonJS compatible

const TOKEN = 'MTQ3MTA4NjQyOTcxNDI1NTkyNQ.G3Uifc.xwx2nhJeHDIv_BH4XOeYoHhExEahptQrtQAcM8';
const CLIENT_ID = '1471086429714255925';
const OWNER_ID = '1460935271389593668';
const APPLICATION_WEBHOOK = 'https://discord.com/api/webhooks/1484326186787012649/VDX9Yd11B0uyzoYg7CZH4vaMwp6lzJedoKpsjrN4UcoA_yj87lyWUCVLIt9TCngSCoRT';

let client = null;
let running = false;

function buildClient() {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: ['CHANNEL'],
  });
}

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('pbp')
      .setDescription('[Owner only] Send a message as the bot and delete yours')
      .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true)),
    new SlashCommandBuilder()
      .setName('ban')
      .setDescription('[Mod] Ban a user')
      .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder()
      .setName('kick')
      .setDescription('[Mod] Kick a user')
      .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason')),
    new SlashCommandBuilder()
      .setName('mute')
      .setDescription('[Mod] Timeout a user')
      .addUserOption(o => o.setName('user').setDescription('User to mute').setRequired(true))
      .addIntegerOption(o => o.setName('duration').setDescription('Duration in minutes (default 10)').setMinValue(1).setMaxValue(10080)),
    new SlashCommandBuilder()
      .setName('application')
      .setDescription('Submit an application to the owner (works in DMs)'),
    new SlashCommandBuilder()
      .setName('connect-vc')
      .setDescription('Make the bot join your voice channel'),
    new SlashCommandBuilder()
      .setName('play')
      .setDescription('[Owner only] Play a song in VC')
      .addStringOption(o => o.setName('song').setDescription('Song name').setRequired(true)),
    new SlashCommandBuilder()
      .setName('pump')
      .setDescription('Bot goes crazy and spams 100 messages then deletes them'),
    new SlashCommandBuilder()
      .setName('host')
      .setDescription('Info about hosting'),
    new SlashCommandBuilder()
      .setName('help')
      .setDescription('Shows all commands'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log('[Bot] Slash commands registered.');
}

function attachEvents(c) {
  c.on('interactionCreate', async interaction => {

    // ── Button: approve / decline application ──────────────────────────────
    if (interaction.isButton()) {
      const [action, applicantId] = interaction.customId.split('_');
      if (action !== 'approve' && action !== 'decline') return;

      if (interaction.user.id !== OWNER_ID)
        return interaction.reply({ content: '❌ Only the owner can use these buttons.', ephemeral: true });

      try {
        const applicant = await c.users.fetch(applicantId);
        if (action === 'approve') {
          await applicant.send('✅ **Your application has been approved!** The owner has accepted it — welcome! Stay tuned for further instructions.');
          await interaction.update({ content: `✅ Application from **${applicant.tag}** — **APPROVED**.`, components: [] });
        } else {
          await applicant.send('❌ **Your application has been declined.** The owner has reviewed it and decided not to accept at this time. You may try again later.');
          await interaction.update({ content: `❌ Application from **${applicant.tag}** — **DECLINED**.`, components: [] });
        }
      } catch (err) {
        console.error('[Bot] Button error:', err);
        await interaction.reply({ content: '⚠️ Something went wrong.', ephemeral: true });
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;
    const { commandName, user, member, guild } = interaction;

    // ── /pbp ────────────────────────────────────────────────────────────────
    if (commandName === 'pbp') {
      if (user.id !== OWNER_ID)
        return interaction.reply({ content: '❌ Owner only command.', ephemeral: true });
      const message = interaction.options.getString('message');
      await interaction.reply({ content: '✅ Sent.', ephemeral: true });
      await interaction.channel.send(message);
      return;
    }

    // ── /ban ────────────────────────────────────────────────────────────────
    if (commandName === 'ban') {
      if (!member?.permissions?.has(PermissionFlagsBits.BanMembers))
        return interaction.reply({ content: '❌ You need the **Ban Members** permission.', ephemeral: true });
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      try {
        await guild.members.ban(target.id, { reason });
        return interaction.reply({ content: `🔨 **${target.tag}** has been banned. Reason: *${reason}*` });
      } catch {
        return interaction.reply({ content: '❌ Could not ban that user. Check my role is above theirs.', ephemeral: true });
      }
    }

    // ── /kick ───────────────────────────────────────────────────────────────
    if (commandName === 'kick') {
      if (!member?.permissions?.has(PermissionFlagsBits.KickMembers))
        return interaction.reply({ content: '❌ You need the **Kick Members** permission.', ephemeral: true });
      const target = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';
      try {
        const m = await guild.members.fetch(target.id);
        await m.kick(reason);
        return interaction.reply({ content: `👢 **${target.tag}** has been kicked. Reason: *${reason}*` });
      } catch {
        return interaction.reply({ content: '❌ Could not kick that user. Check my role is above theirs.', ephemeral: true });
      }
    }

    // ── /mute ───────────────────────────────────────────────────────────────
    if (commandName === 'mute') {
      if (!member?.permissions?.has(PermissionFlagsBits.ModerateMembers))
        return interaction.reply({ content: '❌ You need the **Timeout Members** permission.', ephemeral: true });
      const target = interaction.options.getUser('user');
      const minutes = interaction.options.getInteger('duration') || 10;
      try {
        const m = await guild.members.fetch(target.id);
        await m.timeout(minutes * 60 * 1000);
        return interaction.reply({ content: `🔇 **${target.tag}** has been muted for **${minutes} minute(s)**.` });
      } catch {
        return interaction.reply({ content: '❌ Could not mute that user.', ephemeral: true });
      }
    }

    // ── /application ────────────────────────────────────────────────────────
    if (commandName === 'application') {
      await interaction.reply({ content: '📋 Your application has been submitted! The owner will review it shortly.', ephemeral: true });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`approve_${user.id}`).setLabel('✅ Approve').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`decline_${user.id}`).setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
      );

      try {
        await fetch(APPLICATION_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: `📬 **New Application**\n\n**User:** ${user.tag}\n**ID:** \`${user.id}\`\n**Time:** <t:${Math.floor(Date.now() / 1000)}:F>`,
            components: [row.toJSON()],
          }),
        });
      } catch (err) {
        console.error('[Bot] Webhook error:', err);
      }
      return;
    }

    // ── /connect-vc ─────────────────────────────────────────────────────────
    if (commandName === 'connect-vc') {
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel)
        return interaction.reply({ content: '❌ You need to be in a voice channel first.', ephemeral: true });
      try {
        const { joinVoiceChannel } = require('@discordjs/voice');
        joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
        });
        return interaction.reply({ content: `🔊 Joined **${voiceChannel.name}**!` });
      } catch (err) {
        console.error('[Bot] VC error:', err);
        return interaction.reply({ content: '❌ Could not join VC.', ephemeral: true });
      }
    }

    // ── /play ───────────────────────────────────────────────────────────────
    if (commandName === 'play') {
      if (user.id !== OWNER_ID)
        return interaction.reply({ content: '❌ Owner only command.', ephemeral: true });
      const songQuery = interaction.options.getString('song');
      const voiceChannel = member?.voice?.channel;
      if (!voiceChannel)
        return interaction.reply({ content: '❌ You need to be in a voice channel.', ephemeral: true });

      await interaction.deferReply();
      try {
        const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
        const yts = require('yt-search');
        const ytdl = require('@distube/ytdl-core');

        const results = await yts(songQuery);
        const video = results.videos[0];
        if (!video) return interaction.editReply('❌ No results found.');

        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
        });

        const stream = ytdl(video.url, { filter: 'audioonly', quality: 'lowestaudio' });
        const resource = createAudioResource(stream);
        const player = createAudioPlayer();
        player.play(resource);
        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => connection.destroy());
        player.on('error', err => { console.error('[Bot] Player error:', err); connection.destroy(); });

        return interaction.editReply(`🎵 Now playing: **${video.title}**\n🔗 ${video.url}`);
      } catch (err) {
        console.error('[Bot] Play error:', err);
        return interaction.editReply('❌ Failed to play that song.');
      }
    }

    // ── /pump ───────────────────────────────────────────────────────────────
    if (commandName === 'pump') {
      await interaction.reply({ content: '💥 PUMPING!', ephemeral: true });
      const msgs = [];
      for (let i = 0; i < 100; i++) {
        try {
          const m = await interaction.channel.send('yo bro hehehhe');
          msgs.push(m);
          await new Promise(r => setTimeout(r, 300)); // 300ms gap to respect rate limits
        } catch (err) {
          console.warn('[Bot] Pump send stopped at', i, err.message);
          break;
        }
      }
      await new Promise(r => setTimeout(r, 2000));
      for (const m of msgs) {
        try { await m.delete(); await new Promise(r => setTimeout(r, 100)); } catch {}
      }
      return;
    }

    // ── /host ───────────────────────────────────────────────────────────────
    if (commandName === 'host') {
      return interaction.reply({ content: "🤫 That's not available yet, directly message the owner for it.", ephemeral: true });
    }

    // ── /help ───────────────────────────────────────────────────────────────
    if (commandName === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('📖 Command Reference')
        .setColor(0x1a1a1a)
        .addFields(
          {
            name: '🛡️ Moderation — Mod Only',
            value: '`/ban <user> [reason]` — Permanently ban a user\n`/kick <user> [reason]` — Kick a user\n`/mute <user> [duration]` — Timeout a user (default 10 min)',
          },
          {
            name: '👑 Owner Only',
            value: '`/pbp <message>` — Bot sends your message, yours gets deleted\n`/play <song>` — Play audio in your voice channel',
          },
          {
            name: '🎵 Voice',
            value: '`/connect-vc` — Bot joins your voice channel\n`/play <song>` — Play a song (owner only)',
          },
          {
            name: '📋 General',
            value: '`/application` — Submit an application to the owner (works in DMs)\n`/pump` — Bot spams 100 messages then deletes them\n`/host` — Hosting info\n`/help` — This menu',
          }
        )
        .setFooter({ text: 'Use commands responsibly.' })
        .setTimestamp();
      return interaction.reply({ embeds: [embed] });
    }
  });

  c.once('ready', () => {
    console.log(`[Bot] Online as ${c.user.tag}`);
    c.user.setActivity('Managing the server', { type: 3 });
  });
}

// ─── Start / Stop (recreates client each time so restart works) ───────────────
async function startBot() {
  if (running) return;
  client = buildClient();
  attachEvents(client);
  await registerCommands();
  await client.login(TOKEN);
  running = true;
}

function stopBot() {
  if (!running || !client) return;
  client.destroy();
  client = null;
  running = false;
  console.log('[Bot] Stopped.');
}

function getStatus() { return running; }

module.exports = { startBot, stopBot, getStatus };
