import {
    SlashCommandBuilder,
    AttachmentBuilder
} from 'discord.js';

import {
    createEmbed
} from '../../utils/embeds.js';

import {
    getEconomyData
} from '../../utils/economy.js';

import {
    withErrorHandling,
    createError,
    ErrorTypes
} from '../../utils/errorHandler.js';

import {
    logger
} from '../../utils/logger.js';

import {
    InteractionHelper
} from '../../utils/interactionHelper.js';

import path from 'path';

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your or someone else's Emerald balance")
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check balance for')
                .setRequired(false)
        ),

    execute: withErrorHandling(async (interaction, config, client) => {
        const deferred = await InteractionHelper.safeDefer(interaction);
        if (!deferred) return;

        const userOption = interaction.options.getUser('user');
        const targetUser = userOption || interaction.user;
        const guildId = interaction.guildId;

        logger.info(
            `[EMERALD] Balance check - userOption: ${
                userOption?.id || 'null'
            }, targetUser: ${targetUser.id}, guildId: ${guildId}`
        );

        if (targetUser.bot) {
            throw createError(
                'Bot user queried for balance',
                ErrorTypes.VALIDATION,
                "Bots don't have an Emerald balance."
            );
        }

        const userData = await getEconomyData(
            client,
            guildId,
            targetUser.id
        );

        if (!userData) {
            throw createError(
                'Failed to load economy data',
                ErrorTypes.DATABASE,
                'Failed to load Emerald balance. Please try again later.',
                {
                    userId: targetUser.id,
                    guildId
                }
            );
        }

        const emeralds = Number(userData.emeralds || 0);

        const emeraldPath = path.join(
            process.cwd(),
            'src',
            'emerald.png'
        );

        const emeraldIcon = new AttachmentBuilder(emeraldPath, {
            name: 'emerald.png'
        });

        const embed = createEmbed({
            title: `${targetUser.username}'s Emeralds`,
            description:
                `Here is the current Emerald balance for ${targetUser.username}.`
        })
            .addFields({
                name: 'Emeralds',
                value: `**${emeralds.toLocaleString()}**`,
                inline: false
            })
            .setThumbnail('attachment://emerald.png')
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            });

        logger.info(
            `[EMERALD] Balance retrieved`,
            {
                userId: targetUser.id,
                guildId,
                emeralds
            }
        );

        await InteractionHelper.safeEditReply(interaction, {
            embeds: [embed],
            files: [emeraldIcon]
        });

    }, { command: 'balance' })
};
