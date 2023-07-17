const path = require('path');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const { embedColors, embedIcons, botInfo } = require(path.resolve('./config.json'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show a list of commands and their usage.')
        .setDMPermission(false),
    run: async ({ interaction }) => {
        return await interaction.editReply({
            embeds: [
                new EmbedBuilder()
                    .setDescription(
                        `${embedIcons.rule} **List of commands**\n` +
                            '- **`/play` `query`** - Add a track or playlist to the queue by url or search.\n' +
                            '- **`/pause`** - Pause or resume the current track.\n' +
                            '- **`/queue` `[page]`** - Show the list of tracks added to the queue.\n' +
                            '- **`/nowplaying`** - Show information about the track currently playing.\n' +
                            `- **\`/seek\` \`duration\`** - ${embedIcons.new} Seek to a specified duration in the current track.\n` +
                            `- **\`/loop\` \`mode\`** - ${embedIcons.beta} Toggle looping a track, the whole queue or autoplay.\n` +
                            '- **`/filters`** - Toggle various audio filters during playback.\n' +
                            '- **`/volume` `[percentage]`** - Show or set the playback volume for tracks.\n' +
                            '- **`/skip` `[tracknumber]`** - Skip to next or specified track.\n' +
                            '- **`/remove` `tracknumber`** - Remove specified track from the queue.\n' +
                            '- **`/leave`** - Clear the queue and remove the bot from voice channel.\n\n' +
                            `${embedIcons.support} **Support server**\nJoin the support server for help or suggestions: \n**${botInfo.supportServerInviteUrl}**\n\n` +
                            `${embedIcons.bot} **Enjoying ${botInfo.name}?**\nAdd me to another server: \n**[Click me!](${botInfo.botInviteUrl})**`
                    )
                    .setColor(embedColors.colorInfo)
            ]
        });
    }
};