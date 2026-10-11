import { Events } from 'discord.js';
import { logger } from '../utils/logger.js';

const FLOWER_EMOJIS = new Set([
    '🌼',
    '🌸',
    '🌺',
    '🌻',
    '🌷',
    '💐'
]);

const FLOWER_STICKER_ID = '1558495367014912050';

const THANKS_REGEX =
    /\b(?:thanks?|thank\s*you|thank\s*u|thx|tysm|ty)\b/i;

const rewardedMessages = new Set();
const processingMessages = new Set();
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
        logger.info('Flower sticker and message sent (' + source + ')');
        return true;
    } catch (stickerError) {
        logger.warn(
            'Flower sticker send failed (' + source + '): ' +
            String(stickerError?.message || stickerError)
        );

        try {
            await message.reply({
                content: text,
                allowedMentions: {
                    users: target ? [target.id] : [],
                    repliedUser: false
                }
            });

            logger.info('Flower text fallback sent (' + source + ')');
            return true;
        } catch (textError) {
            logger.error(
                'Flower text fallback also failed:',
                textError
            );
            return false;
        }
    }
}

export function registerFlowerReward(client) {
    if (registeredClients.has(client)) {
        logger.warn('Flower reward system is already registered.');
        return;
    }

    registeredClients.add(client);
    logger.info('Flower reward system registered');

    // Reacting with a flower rewards the author of the message.
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        try {
            if (user.bot) return;

            if (reaction.partial) {
                await reaction.fetch();
            }

            const message = reaction.message;

            if (message.partial) {
                await message.fetch();
            }

            if (!message.guild || !message.author) return;
            if (message.author.bot) return;
            if (!FLOWER_EMOJIS.has(reaction.emoji.name)) return;
            if (message.author.id === user.id) return;

            if (
                rewardedMessages.has(message.id) ||
                processingMessages.has(message.id)
            ) {
                return;
            }

            processingMessages.add(message.id);

            try {
                logger.info(
                    'Flower reaction detected from ' +
                    user.tag +
                    ' on a message by ' +
                    message.author.tag
                );

                const sent = await sendFlower(
                    message,
                    message.author,
                    'The Iron Golem gives ' +
                        message.author.toString() +
                        ' a flower for the great work.',
                    'reaction'
                );

                if (sent) {
                    rewardedMessages.add(message.id);
                }
            } finally {
                processingMessages.delete(message.id);
            }
        } catch (error) {
            logger.error('Flower reaction handler failed:', error);
        }
    });

    // Thank-you messages must mention someone or reply to their message.
    client.on(Events.MessageCreate, async (message) => {
        try {
            if (!message.guild || message.author.bot) return;

            const content = message.content?.trim();

            if (!content || !THANKS_REGEX.test(content)) return;

            logger.info(
                'Thank-you message detected from ' + message.author.tag
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
                    logger.warn(
                        'Could not fetch replied message: ' +
                        String(error?.message || error)
                    );
                }
            }

            if (!target) {
                logger.info(
                    'Thank-you detected, but no eligible mentioned or replied-to user was found.'
                );
                return;
            }

            logger.info(
                'Sending thank-you flower to ' + target.tag
            );

            await sendFlower(
                message,
                target,
                'The Iron Golem gives ' +
                    target.toString() +
                    ' a flower for helping out.',
                'thanks'
            );
        } catch (error) {
            logger.error(
                'Flower thank-you handler failed:',
                error
            );
        }
    });
}
```
