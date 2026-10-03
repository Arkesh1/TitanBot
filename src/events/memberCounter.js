import { Events, ChannelType } from 'discord.js';
import { logger } from '../utils/logger.js';

const CATEGORY_NAME = '📊│Population';
const MEMBER_CHANNEL_PREFIX = '🔒 𝐓𝐨𝐭𝐚𝐥 𝐌𝐞𝐦𝐛𝐞𝐫𝐬:';

const UPDATE_INTERVAL = 30_000; // 30 seconds

async function updateMemberCounter(client) {
    try {
        for (const guild of client.guilds.cache.values()) {
            const category = guild.channels.cache.find(
                (channel) =>
                    channel.type === ChannelType.GuildCategory &&
                    channel.name === CATEGORY_NAME
            );

            if (!category) {
                continue;
            }

            const memberChannel = guild.channels.cache.find(
                (channel) =>
                    channel.type === ChannelType.GuildVoice &&
                    channel.parentId === category.id &&
                    channel.name.startsWith(MEMBER_CHANNEL_PREFIX)
            );

            if (!memberChannel) {
                continue;
            }

            const newName = `${MEMBER_CHANNEL_PREFIX} ${guild.memberCount}`;

            if (memberChannel.name !== newName) {
                await memberChannel.setName(newName);
                logger.debug(
                    `Updated member counter in ${guild.name}: ${guild.memberCount}`
                );
            }
        }
    } catch (error) {
        logger.error('Error updating member counter:', error);
    }
}

export default {
    name: Events.ClientReady,
    once: true,

    async execute(client) {
        // Update immediately when the bot starts
        await updateMemberCounter(client);

        // Keep the counter updated
        setInterval(
            () => updateMemberCounter(client),
            UPDATE_INTERVAL
        );

        logger.info('Member counter system started.');
    },
};
