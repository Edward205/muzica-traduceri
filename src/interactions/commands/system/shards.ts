import config from 'config';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';

import loggerModule from '../../../services/logger';
import { ExtendedClient } from '../../../types/clientTypes';
import { ShardInfo, CustomSlashCommandInteraction } from '../../../types/interactionTypes';
import { EmbedOptions } from '../../../types/configTypes';
import { notValidGuildId } from '../../../utils/validation/systemCommandValidator';

const embedOptions: EmbedOptions = config.get('embedOptions');

const command: CustomSlashCommandInteraction = {
    isSystemCommand: true,
    isNew: false,
    isBeta: false,
    data: new SlashCommandBuilder()
        .setName('shards')
        .setDescription('Show information about the running shards.')
        .setDMPermission(false)
        .setNSFW(false)
        .addStringOption((option) =>
            option
                .setName('sort')
                .setDescription('If specified, what to sort the shards by.')
                .setRequired(false)
                .addChoices(
                    { name: 'None (Shard ID)', value: 'none' },
                    { name: 'Memory usage', value: 'memory' },
                    { name: 'Voice Connections', value: 'connections' },
                    { name: 'Tracks', value: 'tracks' },
                    { name: 'Listeners', value: 'listeners' },
                    { name: 'Guilds', value: 'guilds' },
                    { name: 'Members', value: 'members' }
                )
        )

        .addNumberOption((option) => option.setName('page').setDescription('Page number to show').setMinValue(1)),
    execute: async ({ interaction, client, executionId }) => {
        const logger = loggerModule.child({
            source: 'shards.js',
            module: 'slashCommand',
            name: '/shards',
            executionId: executionId,
            shardId: interaction.guild?.shardId,
            guildId: interaction.guild?.id
        });

        if (await notValidGuildId({ interaction, executionId })) {
            return Promise.resolve();
        }

        let shardInfoList: ShardInfo[] = [];

        logger.debug('Fetching player statistics and client values from each shard.');
        try {
            await client!
                .shard!.broadcastEval((shardClient: ExtendedClient) => {
                    /* eslint-disable no-undef */
                    const playerStats = player.generateStatistics();
                    const nodeProcessMemUsageInMb = parseFloat(
                        (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)
                    );

                    const shardInfo = {
                        shardId: shardClient.shard!.ids[0],
                        memUsage: nodeProcessMemUsageInMb,
                        guildCount: shardClient.guilds.cache.size,
                        guildMemberCount: shardClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
                        playerStatistics: {
                            activeVoiceConnections: playerStats.queues.length,
                            totalTracks: playerStats.queues.reduce((acc, queue) => acc + queue.tracksCount, 0),
                            totalListeners: playerStats.queues.reduce((acc, queue) => acc + queue.listeners, 0)
                        }
                    };

                    return shardInfo;
                })
                .then((results) => {
                    shardInfoList = results.filter(Boolean) as ShardInfo[];

                    switch (interaction.options.getString('sort')) {
                        case 'memory':
                            shardInfoList = shardInfoList.sort((a, b) => b.memUsage - a.memUsage);
                            break;
                        case 'connections':
                            shardInfoList = shardInfoList.sort(
                                (a, b) =>
                                    b.playerStatistics.activeVoiceConnections -
                                    a.playerStatistics.activeVoiceConnections
                            );
                            break;
                        case 'tracks':
                            shardInfoList = shardInfoList.sort(
                                (a, b) => b.playerStatistics.totalTracks - a.playerStatistics.totalTracks
                            );
                            break;
                        case 'listeners':
                            shardInfoList = shardInfoList.sort(
                                (a, b) => b.playerStatistics.totalListeners - a.playerStatistics.totalListeners
                            );
                            break;
                        case 'guilds':
                            shardInfoList = shardInfoList.sort((a, b) => b.guildCount - a.guildCount);
                            break;
                        case 'members':
                            shardInfoList = shardInfoList.sort((a, b) => b.guildMemberCount - a.guildMemberCount);
                            break;
                        default:
                            shardInfoList = shardInfoList.sort((a, b) => a.shardId - b.shardId);
                            break;
                    }

                    logger.debug('Successfully fetched player statistics and client values from shards.');
                });
        } catch (error) {
            logger.error(error, 'Failed to fetch player statistics and client values from shards.');

            logger.debug('Responding with error embed.');
            return await interaction.editReply({
                embeds: [
                    new EmbedBuilder()

                        .setDescription(
                            `**${embedOptions.icons.error} Oops!**\n_Hmm.._ It seems I am unable to fetch player statistics and client values from shards.`
                        )
                        .setColor(embedOptions.colors.error)
                        .setFooter({ text: `Execution ID: ${executionId}` })
                ]
            });
        }

        const shardCount = shardInfoList.length;
        const totalPages = Math.ceil(shardCount / 10) || 1;
        const pageIndex = (interaction.options.getNumber('page') || 1) - 1;

        const currentPageShards = shardInfoList.slice(pageIndex * 10, pageIndex * 10 + 10);

        const evenShardIndexes = currentPageShards.filter((shard, index) => index % 2 === 0);
        const oddShardIndexes = currentPageShards.filter((shard, index) => index % 2 !== 0);

        function shardInfoToString(shard: ShardInfo) {
            let string = '';
            string += `**Shard ${shard.shardId}** - Guilds: ${shard.guildCount.toLocaleString(
                'en-US'
            )} (${shard.guildMemberCount.toLocaleString('en-US')})\n`;
            string += `**Node.js memory:** ${shard.memUsage.toLocaleString('en-US')} MB\n`;
            string += `**┣** Connections: ${shard.playerStatistics.activeVoiceConnections.toLocaleString('en-US')}\n`;
            string += `**┣** Tracks: ${shard.playerStatistics.totalTracks.toLocaleString('en-US')}\n`;
            string += `**┗** Listeners: ${shard.playerStatistics.totalListeners.toLocaleString('en-US')}\n`;
            return string;
        }

        const evenShardIndexesString = evenShardIndexes.map(shardInfoToString).join('\n') + 'ㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤㅤ';
        const oddShardIndexesString = oddShardIndexes.map(shardInfoToString).join('\n');

        const embedFields = [];

        if (currentPageShards.length === 1) {
            embedFields.push({
                name: ' ',
                value: currentPageShards.map(shardInfoToString).join('\n'),
                inline: false
            });
        } else {
            embedFields.push(
                {
                    name: ' ',
                    value: evenShardIndexesString,
                    inline: true
                },
                {
                    name: ' ',
                    value: oddShardIndexesString,
                    inline: true
                }
            );
        }

        logger.debug('Successfully gathered and transformed shard information into embed fields.');

        logger.debug('Responding with info embed.');
        return await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(`**${embedOptions.icons.server} Shard overview - ${shardCount} total shards**\n`)
                    .addFields(...embedFields)
                    .setColor(embedOptions.colors.info)
                    .setFooter({ text: `Shard id: ${client!.shard!.ids[0]}, page ${pageIndex + 1} of ${totalPages}` })
            ]
        });
    }
};

export default command;