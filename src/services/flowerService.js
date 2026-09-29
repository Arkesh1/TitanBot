import { Events } from 'discord.js';
import path from 'path';
import { logger } from '../utils/logger.js';

// Any of these reactions triggers a flower
const FLOWER_EMOJIS = ['🌼', '🌸', '🌺', '🌻', '🌷', '💐'];
const THANKS_REGEX = /\b(thanks?|thank\s*you|thx|tysm|ty)\b/i;

const rewardedMessages = new Set(); // one flower per message, so 5 reactions don't send 5 flowers

export function flowerPayload(target, text) {
    return {
        content: text,
        files: [
            {
                attachment: path.join(process.cwd(), 'src', 'golem-flower.png'),
                name: 'golem-flower.png'
            }
        ],
        allowedMentions: { users: target ? [target.id] : [], repliedUser: false }
    };
}

export function registerFlowerReward(client) {
    logger.info('Flower rewards registered');

    // 1) Flower emoji reaction on someone's message
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        try {
            console.log('[flower] reaction seen:', reaction.emoji.name, 'by', user.tag);

            if (user.bot) return;
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();

            const message = reaction.message;
            if (!FLOWER_EMOJIS.includes(reaction.emoji.name)) return;
            if (!message.guild || !message.author || message.author.bot) return;
            if (message.author.id === user.id) return;    // no self-flowers
            if (rewardedMessages.has(message.id)) return; // already rewarded

            rewardedMessages.add(message.id);

            await message.reply(
                flowerPayload(
                    message.author,
                    `The Iron Golem gives ${message.author} a flower for the great work. 🌼`
                )
            );
        } catch (err) {
            logger.error('Flower reaction error:', err);
        }
    });

    // 2) "Thanks" messages
    client.on(Events.MessageCreate, async (message) => {
        try {
            if (message.author.bot || !message.guild) return;
            console.log('[flower] message seen, content length:', message.content.length);

            if (!THANKS_REGEX.test(message.content)) return;

            // Who is being thanked? First mention, otherwise the author of the replied-to message
            let target = message.mentions.users.find(
                (u) => !u.bot && u.id !== message.author.id
            );

            if (!target && message.reference?.messageId) {
                const replied = await message.fetchReference().catch(() => null);
                if (replied && !replied.author.bot && replied.author.id !== message.author.id) {
                    target = replied.author;
                }
            }

            if (!target) return;

            await message.reply(
                flowerPayload(
                    target,
                    `The Iron Golem gives ${target} a flower for helping out. 🌼`
                )
            );
        } catch (err) {
            logger.error('Flower thanks error:', err);
        }
    });
}
