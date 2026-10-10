
import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

const FLOWER_EMOJIS = ['🌼', '🌸', '🌺', '🌻', '🌷', '💐'];
const FLOWER_STICKER_ID = '1558495367014912050';

const THANKS_REGEX =
    /\b(thanks?|thank\s*you|thank\s*u|thx|tysm|ty)\b/i;

const rewardedMessages = new Set();
const registeredClients = new WeakSet();

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

async function sendFlower(message, target, text, source) {
    try {
        await message.reply(flowerPayload(target, text));
        logger.info(`🌼 Flower response sent (${source})`);
    } catch (error) {
        logger.error(`Failed to send flower (${source}):`, error);
    }
}

export function registerFlowerReward(client) {
    if (registeredClients.has(client)) {
        logger.warn('Flower reward system is already registered.');
        return;
    }

    registeredClients.add(client);
    logger.info('🌼 Flower reward system registered');

    // Flower reactions
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        try {
            if (user.bot) return;

            if (reaction.partial) {
                await reaction.fetch();
            }

            if (reaction.message.partial) {
                await reaction.message.fetch();
            }

            const message = reaction.message;

            if (!message.guild || !message.author) return;
            if (message.author.bot) return;
            if (!FLOWER_EMOJIS.includes(reaction.emoji.name)) return;
            if (message.author.id === user.id) return;
            if (rewardedMessages.has(message.id)) return;

            rewardedMessages.add(message.id);

            logger.info(
                `🌼 ${user.tag} reacted to ${message.author.tag}'s message`
            );

            await sendFlower(
                message,
                message.author,
                `The Iron Golem gives ${message.author} a flower for the great work. 🌼`,
                'reaction'
            );
        } catch (error) {
            logger.error('Flower reaction error:', error);
        }
    });

    // Thank-you messages that mention someone or reply to their message
    client.on(Events.MessageCreate, async (message) => {
        try {
            if (!message.guild || message.author.bot) return;

            const content = message.content?.trim();
            if (!content || !THANKS_REGEX.test(content)) return;

            logger.info(
                `🙏 Thanks detected from ${message.author.tag}: ${content}`
            );

            let target = message.mentions.users.find(
                user =>
                    !user.bot &&
                    user.id !== message.author.id
            );

            if (!target && message.reference?.messageId) {
                try {
                    const repliedMessage = await message.fetchReference();

                    if (
                        repliedMessage?.author &&
                        !repliedMessage.author.bot &&
                        repliedMessage.author.id !== message.author.id
                    ) {
                        target = repliedMessage.author;
                    }
                } catch (error) {
                    logger.debug(
                        'Could not fetch replied message for flower reward.'
                    );
                }
            }

            if (!target) {
                logger.debug(
                    'Thanks detected, but no eligible target was found.'
                );
                return;
            }

            logger.info(
                `🌼 ${message.author.tag} thanked ${target.tag}`
            );

            await sendFlower(
                message,
                target,
                `The Iron Golem gives ${target} a flower for helping out. 🌼`,
                'thanks'
            );
        } catch (error) {
            logger.error('Flower thanks error:', error);
        }
    });
}
