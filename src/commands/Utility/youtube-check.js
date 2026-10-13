
import {
    SlashCommandBuilder,
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';

import { checkYouTubeUploads } from '../../services/youtubeNotifications.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('youtube-check')
        .setDescription(
            'Manually check for the latest Filmy Steve YouTube upload.'
        )
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {
        await interaction.deferReply({
            flags: MessageFlags.Ephemeral,
        });

        try {
            await checkYouTubeUploads(interaction.client);

            await interaction.editReply(
                '✅ YouTube feed checked successfully. If a new upload was detected, the notification was sent.'
            );
        } catch (error) {
            logger.error('Manual YouTube check failed:', error);

            await interaction.editReply(
                '❌ The YouTube check failed. Check the bot logs and try again.'
            );
        }
    },
};
