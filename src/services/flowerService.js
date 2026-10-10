import { Events } from 'discord.js';
import path from 'path';
import { logger } from '../utils/logger.js';

const FLOWER_EMOJIS = ['🌼', '🌸', '🌺', '🌻', '🌷', '💐'];

const THANKS_REGEX =
    /\b(thanks?|thank\s*you|thank\s*u|thx|tysm|ty)\b/i;

// One automatic flower per message
const rewardedMessages = new Set();

// Prevent the service from registering duplicate listeners
const registeredClients = new WeakSet();


const FLOWER_STICKER_ID = '1558495367014912050';

export function flowerPayload(target, text) {
    return {
        content: text,
        stickers: [FLOWER_STICKER_ID],
        allowedMentions: {
            users: target ? [target.id] : [],
            repliedUser: false
        }
    };
}

export function registerFlowerReward(client) {
    // Don't register the listeners more than once
    if (registeredClients.has(client)) {
        return;
    }

    registeredClients.add(client);

    logger.info('🌼 Flower reward system registered');

    /*
     * ==========================================
     * FLOWER REACTION
     * ==========================================
     */

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        try {
            if (user.bot) return;

            // Fetch partial reaction/message when necessary
            if (reaction.partial) {
                await reaction.fetch();
            }

            if (reaction.message.partial) {
                await reaction.message.fetch();
            }

            const message = reaction.message;

            if (!message.guild) return;
            if (!message.author) return;
            if (message.author.bot) return;

            // Only flower reactions trigger the reward
            if (!FLOWER_EMOJIS.includes(reaction.emoji.name)) {
                return;
            }

            // Don't reward someone for reacting to their own message
            if (message.author.id === user.id) {
                return;
            }

            // Already rewarded
            if (rewardedMessages.has(message.id)) {
                return;
            }

            rewardedMessages.add(message.id);

            logger.info(
                `🌼 ${user.tag} reacted to ${message.author.tag}'s message`
            );

            await message.reply(
                flowerPayload(
                    message.author,
                    `The Iron Golem gives ${message.author} a flower for the great work. 🌼`
                )
            );
        } catch (error) {
            logger.error('Flower reaction error:', error);
        }
    });

    /*
     * ==========================================
     * THANKS MESSAGE
     * ==========================================
     */

    client.on(Events.MessageCreate, async (message) => {
        try {
            if (!message.guild) return;
            if (message.author.bot) return;

            const content = message.content?.trim();

            if (!content) return;

            if (!THANKS_REGEX.test(content)) {
                return;
            }

            logger.info(
                `🙏 Thanks detected from ${message.author.tag}: ${content}`
            );

            let target = null;

            /*
             * First: look for a mentioned user.
             *
             * Example:
             * thanks @Steve
             */

            target = message.mentions.users.find(
                (user) =>
                    !user.bot &&
                    user.id !== message.author.id
            );

            /*
             * Second: if the message is a reply,
             * find the author of the replied message.
             *
             * Example:
             *
             * Steve: Here is the solution!
             *
             * User: thanks!
             */

            if (!target && message.reference?.messageId) {
                try {
                    const repliedMessage =
                        await message.fetchReference();

                    if (
                        repliedMessage?.author &&
                        !repliedMessage.author.bot &&
                        repliedMessage.author.id !== message.author.id
                    ) {
                        target = repliedMessage.author;
                    }
                } catch (error) {
                    logger.debug(
                        'Could not fetch replied message for flower reward'
                    );
                }
            }

            // Nobody to give the flower to
            if (!target) {
                return;
            }

            logger.info(
                `🌼 ${message.author.tag} thanked ${target.tag}`
            );

            await message.reply(
                flowerPayload(
                    target,
                    `The Iron Golem gives ${target} a flower for helping out. 🌼`
                )
            );
        } catch (error) {
            logger.error('Flower thanks error:', error);
        }
    });
}
