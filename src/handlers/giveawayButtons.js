import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import { successEmbed } from '../utils/embeds.js';
import { logger } from '../utils/logger.js';
import { TitanBotError, ErrorTypes, handleInteractionError, replyUserError } from '../utils/errorHandler.js';
import { 
    getGuildGiveaways, 
    saveGiveaway, 
    isGiveawayEnded 
} from '../utils/giveaways.js';
import { Mutex } from '../utils/mutex.js';
import { 
    selectWinners,
    isUserRateLimited,
    recordUserInteraction,
    createGiveawayEmbed,
   createGiveawayButtons,
createTicketGiveawayEmbed,
createTicketGiveawayButtons
} from '../services/giveawayService.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';

export const giveawayJoinHandler = {
    customId: 'giveaway_join',
    async execute(interaction, client) {
        try {
            
            if (isUserRateLimited(interaction.user.id, interaction.message.id)) {
                return replyUserError(interaction, { type: ErrorTypes.RATE_LIMIT, message: 'Please wait a moment before interacting with this giveaway again.' });
            }

            await recordUserInteraction(interaction.user.id, interaction.message.id);

            const lockKey = `giveaway:${interaction.message.id}`;
            await Mutex.runExclusive(lockKey, async () => {
                const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
                const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

                if (!giveaway) {
                    throw new TitanBotError(
                        'Giveaway not found in database',
                        ErrorTypes.VALIDATION,
                        'This giveaway is no longer active.',
                        { messageId: interaction.message.id, guildId: interaction.guildId }
                    );
                }

                const endedByTime = isGiveawayEnded(giveaway);
                const endedByFlag = giveaway.ended || giveaway.isEnded;

                if (endedByTime || endedByFlag) {
                    return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'This giveaway has already ended.' });
                }

                const participants = giveaway.participants || [];
                const userId = interaction.user.id;

                if (participants.includes(userId)) {
                    return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'You have already entered this giveaway! 🎉' });
                }

                participants.push(userId);
                giveaway.participants = participants;

                await saveGiveaway(client, interaction.guildId, giveaway);

                logger.debug(`User ${interaction.user.tag} joined giveaway ${interaction.message.id}`);

                const updatedEmbed = createGiveawayEmbed(giveaway, 'active');
                const updatedRow = createGiveawayButtons(false);

                await interaction.message.edit({
                    embeds: [updatedEmbed],
                    components: [updatedRow]
                });

                await interaction.reply({
                    embeds: [
                        successEmbed(
                            'Success! You have entered the giveaway! 🎉',
                            `Good luck! There are now ${participants.length} entry/entries.`
                        )
                    ],
                    flags: MessageFlags.Ephemeral
                });
            });
        } catch (error) {
            logger.error('Error in giveaway join handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_join',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayEndHandler = {
    customId: 'giveaway_end',
    async execute(interaction, client) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the \'Manage Server\' permission to end a giveaway.' });
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway is no longer active.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (giveaway.ended || giveaway.isEnded || isGiveawayEnded(giveaway)) {
                throw new TitanBotError(
                    'Giveaway already ended',
                    ErrorTypes.VALIDATION,
                    'This giveaway has already ended.',
                    { messageId: interaction.message.id }
                );
            }

            const participants = giveaway.participants || [];
            const winners = selectWinners(participants, giveaway.winnerCount);

            giveaway.ended = true;
            giveaway.isEnded = true;
            giveaway.winnerIds = winners;
            giveaway.endedAt = new Date().toISOString();
            giveaway.endedBy = interaction.user.id;

            await saveGiveaway(client, interaction.guildId, giveaway);

            logger.info(`Giveaway ended via button by ${interaction.user.tag}: ${interaction.message.id}`);

            const updatedEmbed = createGiveawayEmbed(giveaway, 'ended', winners);
            const updatedRow = createGiveawayButtons(true);

            await interaction.message.edit({
                content: '🎉 **GIVEAWAY ENDED** 🎉',
                embeds: [updatedEmbed],
                components: [updatedRow]
            });

            try {
                await logEvent({
                    client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_WINNER,
                    data: {
                        description: `Giveaway ended with ${winners.length} winner(s)`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Prize',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 Winners',
                                value: winners.length > 0 
                                    ? winners.map(id => `<@${id}>`).join(', ')
                                    : 'No valid entries',
                                inline: false
                            },
                            {
                                name: '👥 Total Entries',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway end event:', logError);
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Giveaway Ended ✅`,
                        `The giveaway has been ended and ${winners.length} winner(s) have been selected!`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in giveaway end handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_end',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayRerollHandler = {
    customId: 'giveaway_reroll',
    async execute(interaction, client) {
        try {
            
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return replyUserError(interaction, { type: ErrorTypes.PERMISSION, message: 'You need the \'Manage Server\' permission to reroll a giveaway.' });
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway is no longer active.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (!giveaway.ended && !giveaway.isEnded) {
                throw new TitanBotError(
                    'Giveaway still active',
                    ErrorTypes.VALIDATION,
                    'This giveaway has not ended yet. Please end it first.',
                    { messageId: interaction.message.id }
                );
            }

            const participants = giveaway.participants || [];
            
            if (participants.length === 0) {
                throw new TitanBotError(
                    'No participants to reroll',
                    ErrorTypes.VALIDATION,
                    'There are no entries to reroll from.',
                    { messageId: interaction.message.id }
                );
            }

            const newWinners = selectWinners(participants, giveaway.winnerCount);

            giveaway.winnerIds = newWinners;
            giveaway.rerolledAt = new Date().toISOString();
            giveaway.rerolledBy = interaction.user.id;

            await saveGiveaway(client, interaction.guildId, giveaway);

            logger.info(`Giveaway rerolled via button by ${interaction.user.tag}: ${interaction.message.id}`);

            const updatedEmbed = createGiveawayEmbed(giveaway, 'reroll', newWinners);
            const updatedRow = createGiveawayButtons(true);

            await interaction.message.edit({
                content: '🔄 **GIVEAWAY REROLLED** 🔄',
                embeds: [updatedEmbed],
                components: [updatedRow]
            });

            try {
                await logEvent({
                    client,
                    guildId: interaction.guildId,
                    eventType: EVENT_TYPES.GIVEAWAY_REROLL,
                    data: {
                        description: `Giveaway rerolled`,
                        channelId: interaction.channelId,
                        userId: interaction.user.id,
                        fields: [
                            {
                                name: '🎁 Prize',
                                value: giveaway.prize || 'Mystery Prize!',
                                inline: true
                            },
                            {
                                name: '🏆 New Winners',
                                value: newWinners.map(id => `<@${id}>`).join(', '),
                                inline: false
                            },
                            {
                                name: '👥 Total Entries',
                                value: participants.length.toString(),
                                inline: true
                            }
                        ]
                    }
                });
            } catch (logError) {
                logger.debug('Error logging giveaway reroll event:', logError);
            }

            await interaction.reply({
                embeds: [
                    successEmbed(
                        'Giveaway Rerolled ✅',
                        `New winner(s) have been selected!`
                    )
                ],
                flags: MessageFlags.Ephemeral
            });

        } catch (error) {
            logger.error('Error in giveaway reroll handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_reroll',
                handler: 'giveaway'
            });
        }
    }
};

export const giveawayViewHandler = {
    customId: 'giveaway_view',
    async execute(interaction, client) {
        try {
            if (!interaction.inGuild()) {
                throw new TitanBotError(
                    'Button used outside guild',
                    ErrorTypes.VALIDATION,
                    'This button can only be used in a server.',
                    { userId: interaction.user.id }
                );
            }

            const guildGiveaways = await getGuildGiveaways(client, interaction.guildId);
            const giveaway = guildGiveaways.find(g => g.messageId === interaction.message.id);

            if (!giveaway) {
                throw new TitanBotError(
                    'Giveaway not found in database',
                    ErrorTypes.VALIDATION,
                    'This giveaway could not be found.',
                    { messageId: interaction.message.id, guildId: interaction.guildId }
                );
            }

            if (!giveaway.ended && !giveaway.isEnded && !isGiveawayEnded(giveaway)) {
                return replyUserError(interaction, { type: ErrorTypes.UNKNOWN, message: 'This giveaway has not ended yet, so winners are not available.' });
            }

            const winnerIds = Array.isArray(giveaway.winnerIds) ? giveaway.winnerIds : [];
            const winnerMentions = winnerIds.length > 0
                ? winnerIds.map(id => `<@${id}>`).join(', ')
                : 'No valid winners were selected for this giveaway.';

            await interaction.reply({
                embeds: [
                    successEmbed(
                        `Winners for ${giveaway.prize || 'this giveaway'} 🎉`,
                        winnerMentions
                    )
                ],
                flags: MessageFlags.Ephemeral
            });
        } catch (error) {
            logger.error('Error in giveaway view handler:', error);
            await handleInteractionError(interaction, error, {
                type: 'button',
                customId: 'giveaway_view',
                handler: 'giveaway'
            });
        }
    }
    export const emeraldGiveawayBuyHandler = {
    customId: 'emerald_giveaway_buy',

    async execute(interaction, client) {
        try {
            if (!interaction.inGuild()) {
                return replyUserError(interaction, {
                    type: ErrorTypes.VALIDATION,
                    message:
                        'This button can only be used in a server.'
                });
            }

            if (
                isUserRateLimited(
                    interaction.user.id,
                    interaction.message.id
                )
            ) {
                return replyUserError(interaction, {
                    type: ErrorTypes.RATE_LIMIT,
                    message:
                        'Please wait a moment before buying another ticket.'
                });
            }

            await recordUserInteraction(
                interaction.user.id,
                interaction.message.id
            );

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            });

            const lockKey =
                `emerald-giveaway:${interaction.message.id}`;

            await Mutex.runExclusive(
                lockKey,
                async () => {
                    const guildGiveaways =
                        await getGuildGiveaways(
                            client,
                            interaction.guildId
                        );

                    const giveaway =
                        guildGiveaways.find(
                            (g) =>
                                g.messageId ===
                                interaction.message.id
                        );

                    if (
                        !giveaway ||
                        giveaway.ticketBased !== true
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ This giveaway could not be found.'
                        });
                    }

                    if (
                        giveaway.ended ||
                        giveaway.isEnded ||
                        isGiveawayEnded(giveaway)
                    ) {
                        return interaction.editReply({
                            content:
                                '❌ This giveaway has already ended.'
                        });
                    }

                    const tickets =
                        Array.isArray(
                            giveaway.tickets
                        )
                            ? giveaway.tickets
                            : [];

                    const userTickets =
                        tickets.filter(
                            (ticket) =>
                                ticket.userId ===
                                interaction.user.id
                        ).length;

                    const maxTickets =
                        Number(
                            giveaway.maxTicketsPerUser ||
                            5
                        );

                    const ticketPrice =
                        Number(
                            giveaway.ticketPrice ||
                            100
                        );

                    if (
                        userTickets >=
                        maxTickets
                    ) {
                        return interaction.editReply({
                            content:
                                `❌ You already have the maximum of **${maxTickets} tickets**.`
                        });
                    }

                    let charged = false;

                    try {
                        const newBalance =
                            await EconomyService.removeEmeralds(
                                client,
                                interaction.guildId,
                                interaction.user.id,
                                ticketPrice,
                                `giveaway-ticket:${interaction.message.id}`
                            );

                        charged = true;

                        const ticketNumber =
                            tickets.length + 1;

                        tickets.push({
                            number: ticketNumber,
                            userId:
                                interaction.user.id,
                            purchasedAt:
                                new Date().toISOString(),
                        });

                        giveaway.tickets =
                            tickets;

                        giveaway.ticketCount =
                            tickets.length;

                        const saved =
                            await saveGiveaway(
                                client,
                                interaction.guildId,
                                giveaway
                            );

                        if (!saved) {
                            throw new Error(
                                'Failed to save the ticket purchase.'
                            );
                        }

                        try {
                            await interaction.message.edit({
                                embeds: [
                                    createTicketGiveawayEmbed(
                                        giveaway,
                                        'active'
                                    ),
                                ],
                                components: [
                                    createTicketGiveawayButtons(
                                        false
                                    ),
                                ],
                            });
                        } catch (editError) {
                            logger.warn(
                                'Could not update ticket giveaway message:',
                                editError.message
                            );
                        }

                        await interaction.editReply({
                            content:
                                `🎟️ **Ticket #${ticketNumber} purchased!**\n` +
                                `💎 Cost: **${ticketPrice} Emeralds**\n` +
                                `💎 Remaining: **${newBalance} Emeralds**\n` +
                                `🎟️ Your tickets: **${userTickets + 1}/${maxTickets}**`
                        });

                    } catch (error) {
                        if (charged) {
                            await EconomyService
                                .addEmeralds(
                                    client,
                                    interaction.guildId,
                                    interaction.user.id,
                                    ticketPrice,
                                    `giveaway-ticket-refund:${interaction.message.id}`
                                )
                                .catch(
                                    (refundError) => {
                                        logger.error(
                                            'Failed to refund Emerald ticket purchase:',
                                            refundError
                                        );
                                    }
                                );
                        }

                        throw error;
                    }
                }
            );
        } catch (error) {
            logger.error(
                'Error in Emerald giveaway ticket handler:',
                error
            );

            await handleInteractionError(
                interaction,
                error,
                {
                    type: 'button',
                    customId:
                        'emerald_giveaway_buy',
                    handler: 'giveaway'
                }
            );
        }
    }
};
};
