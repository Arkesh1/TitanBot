import { Events } from 'discord.js';
import path from 'path';
import { logger } from '../utils/logger.js';

const FLOWER_EMOJI = '🌼';
const THANKS_REGEX = /\b(thanks?|thank\s*you|thx|tysm|ty)\b/i;

// Anti-spam for the automatic rewards (reaction + thanks)
const TARGET_COOLDOWN_MS = 10 * 60 * 1000; // 10 min between flowers per person
const DAILY_CAP = 3;                       // max automatic flowers per person per day

const lastReward = new Map();       // userId -> timestamp
const dailyCount = new Map();       // userId -> { day, count }
const rewardedMessages = new Set(); // message IDs already rewarded via reaction

function canReward(userId) {
    const now = Date.now();
    if (now - (lastReward.get(userId) ?? 0) < TARGET_COOLDOWN_MS) return false;

    const today = new Date().toDateString();
    const daily = dailyCount.get(userId);
    if (daily && daily.day === today && daily.count >= DAILY_CAP) return false;
    return true;
}

function markRewarded(userId) {
    const today = new Date().toDateString();
    const daily = dailyCount.get(userId);
    dailyCount.set(userId, {
        day: today,
        count: daily && daily.day === today ? daily.count + 1 : 1
    });
    lastReward.set(userId, Date.now());
}

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
    // 1) A single 🌼 reaction on someone's message
    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        try {
            if (user.bot) return;
            if (reaction.partial) await reaction.fetch();
            if (reaction.message.partial) await reaction.message.fetch();

            const message = reaction.message;
            if (reaction.emoji.name !== FLOWER_EMOJI) return;
            if (!message.guild || !message.author || message.author.bot) return;
            if (message.author.id === user.id) return;     // no self-flowers
            if (rewardedMessages.has(message.id)) return;  // one flower per message
            if (!canReward(message.author.id)) return;

            rewardedMessages.add(message.id);
            markRewarded(message.author.id);

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

            if (!target || !canReward(target.id)) return;
            markRewarded(target.id);

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
