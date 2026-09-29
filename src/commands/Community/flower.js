import { SlashCommandBuilder } from 'discord.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';
import { logger } from '../../utils/logger.js';

import {
    flowerPayload,
    registerFlowerReward
} from '../../services/flowerService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('flower')
        .setDescription('The Iron Golem gives a flower')
        .addUserOption((o) =>
            o
                .setName('user')
                .setDescription('Who gets the flower (optional)')
                .setRequired(false)
        ),

    category: 'community',

    async execute(interaction, config, client) {
        /*
         * Make sure the automatic flower system is running.
         *
         * The WeakSet inside flowerService.js prevents
         * duplicate listeners if /flower is used multiple times.
         */
        registerFlowerReward(client);

        const deferSuccess =
            await InteractionHelper.safeDefer(interaction);

        if (!deferSuccess) {
            logger.warn('Flower interaction defer failed', {
                userId: interaction.user.id,
                guildId: interaction.guildId,
                commandName: 'flower'
            });

            return;
        }

        const target = interaction.options.getUser('user');

        const text = target
            ? `The Iron Golem gives ${target} a flower. 🌼`
            : 'The Iron Golem gives you a flower. 🌼';

        await InteractionHelper.safeEditReply(
            interaction,
            flowerPayload(target, text)
        );
    }
};
