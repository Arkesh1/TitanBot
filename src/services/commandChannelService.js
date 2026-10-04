import { logger } from '../utils/logger.js';

const COMMAND_CHANNEL_KEY_PREFIX = 'guild:';

function getStoreKey(guildId) {
    return `${COMMAND_CHANNEL_KEY_PREFIX}${guildId}:command-channels`;
}

async function getCommandChannels(client, guildId) {
    try {
        const data = await client.db.get(getStoreKey(guildId));
        return data && typeof data === 'object' ? data : {};
    } catch (error) {
        logger.error('Error loading command channel settings:', error);
        return {};
    }
}

async function saveCommandChannels(client, guildId, data) {
    try {
        await client.db.set(getStoreKey(guildId), data);
        return true;
    } catch (error) {
        logger.error('Error saving command channel settings:', error);
        return false;
    }
}

export async function getCommandChannel(client, guildId, commandName) {
    const settings = await getCommandChannels(client, guildId);

    return settings[commandName] || null;
}

export async function setCommandChannel(
    client,
    guildId,
    commandName,
    channelId
) {
    const settings = await getCommandChannels(client, guildId);

    if (channelId) {
        settings[commandName] = channelId;
    } else {
        delete settings[commandName];
    }

    return saveCommandChannels(client, guildId, settings);
}

export async function clearCommandChannel(
    client,
    guildId,
    commandName
) {
    return setCommandChannel(
        client,
        guildId,
        commandName,
        null
    );
}
