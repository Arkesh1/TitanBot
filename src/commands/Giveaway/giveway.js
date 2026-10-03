import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';

import { saveGiveaway } from '../../utils/giveaways.js';

import {
    parseDuration,
    validatePrize,
    createTicketGiveawayEmbed,
    createTicketGiveawayButtons,
} from '../../services/giveawayService.js';

import { logger } from '../../utils/logger.js';
import { logEvent, EVENT_TYPES } from '../../services/loggingService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Create an Emerald ticket giveaway')
        .addSubcommand((subcommand) =>
            subcommand
                .setName('create')
                .setDescription('Create a new Emerald ticket giveaway')
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({
                content: '❌ You need the Manage Server permission.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (interaction.options.getSubcommand() !== 'create') {
            return interaction.reply({
                content: '❌ Unknown giveaway action.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('emerald_giveaway_create_modal')
            .setTitle('Create Giveaway');

        const prizeInput = new TextInputBuilder()
            .setCustomId('giveaway_prize')
            .setLabel('Prize')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('What is the prize?')
            .setRequired(true)
            .setMaxLength(256);

        const durationInput = new TextInputBuilder()
            .setCustomId('giveaway_duration')
            .setLabel('Duration')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Examples: 30m, 2h, 3d, 12h')
            .setRequired(true)
            .setMaxLength(20);

        modal.addComponents(
            new ActionRowBuilder().addComponents(prizeInput),
            new ActionRowBuilder().addComponents(durationInput),
        );

        await interaction.showModal(modal);

        let modalInteraction = null;

        try {
            modalInteraction = await interaction.awaitModalSubmit({
                time: 120_000,
                filter: (submitted) =>
                    submitted.customId === 'emerald_giveaway_create_modal' &&
                    submitted.user.id === interaction.user.id,
            });

            await modalInteraction.deferReply({
                flags: MessageFlags.Ephemeral,
            });

            const prize = validatePrize(
                modalInteraction.fields.getTextInputValue('giveaway_prize')
            );

            const durationString = modalInteraction.fields
                .getTextInputValue('giveaway_duration')
                .trim();

            const durationMs = parseDuration(durationString);
            const endTime = Date.now() + durationMs;

            const giveawayData = {
                messageId: 'placeholder',
                channelId: interaction.channelId,
                guildId: interaction.guildId,

                prize,
                hostId: interaction.user.id,

                endTime,
                endsAt: endTime,

                winnerCount: 1,

                participants: [],

                ticketBased: true,
                ticketPrice: 100,
                maxTicketsPerUser: 5,

                tickets: [],
                ticketCount: 0,

                isEnded: false,
                ended: false,

                createdAt: new Date().toISOString(),
            };

            const embed = createTicketGiveawayEmbed(
                giveawayData,
                'active'
            );

            const row = createTicketGiveawayButtons(false);

            const giveawayMessage = await interaction.channel.send({
                embeds: [embed],
                components: [row],
            });

            giveawayData.messageId = giveawayMessage.id;

            const saved = await saveGiveaway(
                interaction.client,
                interaction.guildId,
                giveawayData,
            );

            if (!saved) {
                await giveawayMessage.delete().catch(() => {});

                throw new Error(
                    'Failed to save giveaway to the database.'
                );
            }

            await modalInteraction.editReply({
                content: `✅ Giveaway created in ${interaction.channel}.`,
            });

            try {
                await logEvent({
                    client: interaction.client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_CREATE,
                    data: {
                        description: `Emerald ticket giveaway created: ${prize}`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: 'Prize',
                                value: prize,
                                inline: true,
                            },
                            {
                                name: 'Ticket Price',
                                value: '100 Emeralds',
                                inline: true,
                            },
                            {
                                name: 'Duration',
                                value: durationString,
                                inline: true,
                            },
                        ],
                    },
                });
            } catch (logError) {
                logger.debug(
                    'Error logging ticket giveaway creation:',
                    logError
                );
            }
        } catch (error) {
            logger.error(
                'Error creating Emerald ticket giveaway:',
                error
            );

            if (modalInteraction?.deferred || modalInteraction?.replied) {
                await modalInteraction.editReply({
                    content: `❌ Giveaway creation failed.\n\`${error.message || 'Unknown error'}\``,
                }).catch((replyError) => {
                    logger.error(
                        'Could not send giveaway error reply:',
                        replyError
                    );
                });
            }
        }
    },
};
