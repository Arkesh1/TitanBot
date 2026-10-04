import { logger } from '../utils/logger.js';

const COMMAND_SETTINGS_KEY_PREFIX = 'guild:';

function getStoreKey(guildId) {
    return `${COMMAND_SETTINGS_KEY_PREFIX}${guildId}:command-settings`;
}

async function getCommandSettingsStore(client, guildId) {
    try {
        const data = await client.db.get(getStoreKey(guildId));

        if (!data || typeof data !== 'object') {
            return {};
        }

        return data;
    } catch (error) {
        logger.error('Error loading command settings:', error);
        return {};
    }
}

async function saveCommandSettingsStore(client, guildId, data) {
    try {
        await client.db.set(getStoreKey(guildId), data);
        return true;
    } catch (error) {
        logger.error('Error saving command settings:', error);
        return false;
    }
}

export async function getCommandSettings(
    client,
    guildId,
    commandName
) {
    const settings = await getCommandSettingsStore(
        client,
        guildId
    );

    return settings[commandName] || {
        channelId: null,
        visibility: 'public',
    };
}

export async function setCommandSettings(
    client,
    guildId,
    commandName,
    settings
) {
    const current = await getCommandSettingsStore(
        client,
        guildId
    );

    current[commandName] = {
        channelId: settings.channelId || null,
        visibility:
            settings.visibility === 'private'
                ? 'private'
                : 'public',
    };

    return saveCommandSettingsStore(
        client,
        guildId,
        current
    );
}

export async function getCommandChannel(
    client,
    guildId,
    commandName
) {
    const settings = await getCommandSettings(
        client,
        guildId,
        commandName
    );

    return settings.channelId || null;
}

export async function setCommandChannel(
    client,
    guildId,
    commandName,
    channelId
) {
    const current = await getCommandSettings(
        client,
        guildId,
        commandName
    );

    return setCommandSettings(
        client,
        guildId,
        commandName,
        {
            channelId,
            visibility: current.visibility,
        }
    );
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
