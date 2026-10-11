import { SlashCommandBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

import {
    flowerPayload
} from '../../services/flowerService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('flower')
        .setDescription('The Iron Golem gives a flower')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('Who gets the flower (optional)')
                .setRequired(false)
        ),

    category: 'community',

    async execute(interaction, config, client) {
        const deferred =
            await InteractionHelper.safeDefer(interaction);

        if (!deferred) return;

        const target = interaction.options.getUser('user');

        const text = target
            ? `The Iron Golem gives ${target} a flower. 🌼`
            : 'The Iron Golem gives you a flower. 🌼';

        try {
            await interaction.editReply(
                flowerPayload(target, text)
            );

            logger.info('🌼 /flower sticker sent successfully');
        } catch (error) {
            logger.warn(
                `Could not send /flower sticker: ${error.message}`
            );

            try {
                await interaction.editReply({
                    content: text,
                    allowedMentions: {
                        users: target ? [target.id] : [],
                        repliedUser: false
                    }
                });
            } catch (fallbackError) {
                logger.error(
                    'Could not send /flower fallback:',
                    fallbackError
                );
            }
        }
    }
};
