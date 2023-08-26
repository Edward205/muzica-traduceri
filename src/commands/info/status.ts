import config from 'config';
const embedOptions = config.get('embedOptions');
const { getUptimeFormatted } = require('../../utils/system/getUptimeFormatted');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
import osu from 'node-os-utils';
const { version } = require('../../../package.json');

module.exports = {
    isNew: false,
    isBeta: false,
    data: new SlashCommandBuilder()
        .setName('status')
        .setDescription('Show the bot and system status.')
        .setDMPermission(false)
        .setNSFW(false),
    execute: async ({ interaction, client, executionId }) => {
        const logger = require('../../services/logger').child({
            source: 'status.js',
            module: 'slashCommand',
            name: '/status',
            executionId: executionId,
            shardId: interaction.guild.shardId,
            guildId: interaction.guild.id
        });

        const uptimeString = await getUptimeFormatted({ executionId });
        const usedMemoryInMB = Math.ceil((await osu.mem.info()).usedMemMb).toLocaleString('en-US');
        const cpuUsage = await osu.cpu.usage();
        const releaseVersion = version;
        let guildCount = 0;
        let memberCount = 0;
        let activeVoiceConnections = 0;
        let totalTracks = 0;
        let totalListeners = 0;

        await client.shard
            .broadcastEval(() => {
                /* eslint-disable no-undef */
                return player.generateStatistics();
            })
            .then((results) => {
                const queueCountList = [];
                const trackCountList = [];
                const listenerCountList = [];
                results.map((result) => {
                    queueCountList.push(result.queues.length);
                    if (result.queues.length > 0) {
                        result.queues.map((queue) => {
                            trackCountList.push(queue.status.playing ? queue.tracksCount + 1 : queue.tracksCount);
                            listenerCountList.push(queue.listeners);
                        });
                    }
                });

                activeVoiceConnections = queueCountList.reduce((acc, queueAmount) => acc + queueAmount, 0);
                totalTracks = trackCountList.reduce((acc, trackAmount) => acc + trackAmount, 0);
                totalListeners = listenerCountList.reduce((acc, listenerAmount) => acc + listenerAmount, 0);

                logger.debug('Successfully fetched player statistics from shards.');
            })
            .catch((error) => {
                logger.error(error, 'Failed to fetch player statistics from shards.');
            });

        await client.shard
            .fetchClientValues('guilds.cache')
            .then((results) => {
                results.map((guildCache) => {
                    if (guildCache) {
                        guildCount += guildCache.length;
                        memberCount += guildCache.reduce((acc, guildCache) => acc + guildCache.memberCount, 0);
                    }
                });

                logger.debug('Successfully fetched client values from shards.');
            })
            .catch((error) => {
                logger.error(error, 'Failed to fetch client values from shards.');
            });

        const botStatusString =
            `**${guildCount.toLocaleString('en-US')}** Joined servers\n` +
            `**${memberCount.toLocaleString('en-US')}** Total members\n` +
            `**v${releaseVersion}** Release version`;

        const queueStatusString =
            `**${activeVoiceConnections.toLocaleString('en-US')}** Voice connections\n` +
            `**${totalTracks.toLocaleString('en-US')}** Tracks in queues\n` +
            `**${totalListeners.toLocaleString('en-US')}** Users listening`;

        const systemStatusString =
            `**${uptimeString}** Uptime\n` + `**${cpuUsage}%** CPU usage\n` + `**${usedMemoryInMB} MB** Memory usage`;

        const discordStatusString = `**${client.ws.ping} ms** Discord API latency`;

        logger.debug('Transformed status into into embed description.');

        logger.debug('Responding with info embed.');
        return await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`**${embedOptions.icons.bot} Bot status**\n` + botStatusString)
                    .addFields(
                        {
                            name: `**${embedOptions.icons.queue} Queue status**`,
                            value: queueStatusString,
                            inline: false
                        },
                        {
                            name: `**${embedOptions.icons.server} System status**`,
                            value: systemStatusString,
                            inline: false
                        },
                        {
                            name: `**${embedOptions.icons.discord} Discord status**`,
                            value: discordStatusString,
                            inline: false
                        }
                    )
                    .setColor(embedOptions.colors.info)
            ]
        });
    }
};
