import { Events, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { getColor, botConfig } from '../config/bot.js';
import { getGuildConfig } from '../services/config/guildConfig.js';
import { getWelcomeConfig } from '../utils/database.js';
import { formatWelcomeMessage } from '../utils/welcome.js';
import { logEvent, EVENT_TYPES } from '../services/loggingService.js';
import { getServerCounters, updateCounter } from '../services/serverstatsService.js';
import { setBirthday as dbSetBirthday } from '../utils/database.js';
import { logger } from '../utils/logger.js';
import { createWelcomeCard } from '../utils/welcomeCard.js';
import EconomyService from '../services/economyService.js';

export default {
    name: Events.GuildMemberAdd,
    once: false,

    async execute(member) {
        try {
            const { guild, user } = member;

            const config = await getGuildConfig(
                member.client,
                guild.id
            );

            const welcomeConfig = await getWelcomeConfig(
                member.client,
                guild.id
            );

            const welcomeChannelId = welcomeConfig?.channelId;

            // =====================================================
            // INVITE REWARD
            // =====================================================

            if (!user.bot) {
                try {
                    const client = member.client;

                    const oldInvites =
                        client.inviteCache?.get(guild.id) ||
                        new Map();

                    const newInvites =
                        await guild.invites.fetch();

                    let usedInvite = null;

                    for (const invite of newInvites.values()) {
                        const oldInvite =
                            oldInvites.get(invite.code);

                        const oldUses =
                            oldInvite?.uses || 0;

                        const newUses =
                            invite.uses || 0;

                        if (newUses > oldUses) {
                            usedInvite = invite;
                            break;
                        }
                    }

                    // -------------------------------------------------
                    // UPDATE INVITE CACHE
                    // -------------------------------------------------

                    const updatedInviteData = new Map();

                    for (const invite of newInvites.values()) {
                        updatedInviteData.set(
                            invite.code,
                            {
                                uses: invite.uses || 0,
                                inviterId:
                                    invite.inviter?.id || null
                            }
                        );
                    }

                    if (client.inviteCache) {
                        client.inviteCache.set(
                            guild.id,
                            updatedInviteData
                        );
                    }

                    // -------------------------------------------------
                    // REWARD INVITER
                    // -------------------------------------------------

                    if (
                        usedInvite &&
                        usedInvite.inviter &&
                        usedInvite.inviter.id !== user.id
                    ) {
                        const inviterId =
                            usedInvite.inviter.id;

                        await EconomyService.addEmeralds(
                            client,
                            guild.id,
                            inviterId,
                            100,
                            'invite-reward'
                        );

                        logger.info(
                            `Awarded 100 Emeralds to ${inviterId} for inviting ${user.id} in guild ${guild.id}`
                        );

                        // -------------------------------------------------
                        // PUBLIC INVITE REWARD MESSAGE
                        // -------------------------------------------------

                   try {
    const channel = guild.channels.cache.find(
        channel => channel.name === '📥│invite-rewards'
    );

    if (channel?.isTextBased()) {
        const permissions =
            channel.permissionsFor(guild.members.me);

        if (
            permissions?.has(
                PermissionFlagsBits.ViewChannel
            ) &&
            permissions?.has(
                PermissionFlagsBits.SendMessages
            )
        ) {
            await channel.send(
                `💎 <@${inviterId}> earned **100 Emeralds** for inviting ${user}!`
            );
        }
    }
} catch (error) {
    logger.debug(
        'Could not send invite reward message:',
        error
    );
}
            // =====================================================
            // WELCOME MESSAGE + WELCOME CARD
            // =====================================================

            if (welcomeConfig?.enabled && welcomeChannelId) {
                const channel = guild.channels.cache.get(
                    welcomeChannelId
                );

                const me = guild.members.me;

                const permissions =
                    channel?.isTextBased?.() && me
                        ? channel.permissionsFor(me)
                        : null;

                // Skip only the welcome message if permissions
                // are missing. The rest of the join pipeline
                // will still run.
                if (
                    permissions?.has([
                        PermissionFlagsBits.ViewChannel,
                        PermissionFlagsBits.SendMessages
                    ])
                ) {
                    const formatData = {
                        user,
                        guild,
                        member
                    };

                    const welcomeMessage =
                        formatWelcomeMessage(
                            welcomeConfig.welcomeMessage ||
                            welcomeConfig.welcomeEmbed?.description ||
                            botConfig.welcome?.defaultWelcomeMessage ||
                            'Welcome {user} to {server}!',
                            formatData
                        );

                    const messageContent =
                        welcomeConfig.welcomePing
                            ? user.toString()
                            : null;

                    const embedTitle =
                        formatWelcomeMessage(
                            welcomeConfig.welcomeEmbed?.title ||
                            '🎉 Welcome!',
                            formatData
                        );

                    const embedFooter =
                        welcomeConfig.welcomeEmbed?.footer
                            ? formatWelcomeMessage(
                                  welcomeConfig.welcomeEmbed.footer,
                                  formatData
                              )
                            : `Welcome to ${guild.name}!`;

                    const canEmbed =
                        permissions.has(
                            PermissionFlagsBits.EmbedLinks
                        );

                    // -------------------------------------------------
                    // FALLBACK IF EMBEDS ARE NOT AVAILABLE
                    // -------------------------------------------------

                    if (!canEmbed) {
                        await channel.send({
                            content:
                                messageContent ||
                                welcomeMessage
                        });
                    }

                    // -------------------------------------------------
                    // WELCOME CARD
                    // -------------------------------------------------

                    else {
                        try {
                            const cardBuffer =
                                await createWelcomeCard({
                                    user,
                                    guild,
                                    welcomeMessage
                                });

                            const embed =
                                new EmbedBuilder()
                                    .setColor(
                                        welcomeConfig
                                            .welcomeEmbed
                                            ?.color ||
                                        getColor('success')
                                    )
                                    .setDescription(
                                        welcomeMessage
                                    )
                                    .setImage(
                                        'attachment://welcome-card.png'
                                    )
                                    .setTimestamp()
                                    .setFooter({
                                        text: embedFooter
                                    });

                            await channel.send({
                                content: messageContent,
                                embeds: [embed],
                                files: [
                                    {
                                        attachment:
                                            cardBuffer,
                                        name: 'welcome-card.png'
                                    }
                                ]
                            });

                        } catch (error) {
                            logger.warn(
                                'Failed to generate welcome card, falling back to normal embed:',
                                error
                            );

                            // -------------------------------------------------
                            // NORMAL EMBED FALLBACK
                            // -------------------------------------------------

                            const embed =
                                new EmbedBuilder()
                                    .setColor(
                                        welcomeConfig
                                            .welcomeEmbed
                                            ?.color ||
                                        getColor('success')
                                    )
                                    .setTitle(
                                        embedTitle
                                    )
                                    .setDescription(
                                        welcomeMessage
                                    )
                                    .setThumbnail(
                                        user.displayAvatarURL()
                                    )
                                    .setTimestamp()
                                    .setFooter({
                                        text: embedFooter
                                    });

                            await channel.send({
                                content: messageContent,
                                embeds: [embed]
                            });
                        }
                    }
                }
            }

            // =====================================================
            // FIRST 500 OG MEMBERS
            // =====================================================

            /*
             * Simple OG system:
             *
             * Current member count <= 500
             *       ↓
             * Give OG role
             *       ↓
             * Send public OG message
             *       ↓
             * Send OG DM
             *
             * Bots are excluded.
             */

            if (!user.bot && guild.memberCount <= 501) {

                // -------------------------------------------------
                // FIND OG ROLE
                // -------------------------------------------------

                const ogRole = guild.roles.cache.find(
                    role =>
                        role.name === '⭐ OG VILLAGERS'
                );

                // -------------------------------------------------
                // GIVE OG ROLE
                // -------------------------------------------------

                if (ogRole) {
                    await assignRoleSafely(
                        member,
                        ogRole
                    );
                } else {
                    logger.warn(
                        `OG role "⭐ OG VILLAGERS" not found in guild ${guild.id}`
                    );
                }

                // -------------------------------------------------
                // PUBLIC OG MESSAGE
                // -------------------------------------------------

                if (welcomeChannelId) {
                    try {
                        const channel =
                            guild.channels.cache.get(
                                welcomeChannelId
                            );

                        if (channel?.isTextBased()) {
                            const permissions =
                                channel.permissionsFor(
                                    guild.members.me
                                );

                            if (
                                permissions?.has(
                                    PermissionFlagsBits.ViewChannel
                                ) &&
                                permissions?.has(
                                    PermissionFlagsBits.SendMessages
                                )
                            ) {
                                await channel.send(
                                    `\u200B\n🏆 **Congrats, You're One of the first 500 OG VILLAGERS!**`
                                );
                            }
                        }

                    } catch (error) {
                        logger.debug(
                            `Could not send OG welcome message for ${user.id}:`,
                            error
                        );
                    }
                }

                // -------------------------------------------------
                // OG DIRECT MESSAGE
                // -------------------------------------------------

                try {
                    await user.send(
                        `🏆 **You're an OG!**\n\n` +
                        `Congrats! You're one of the first 500 members of the Filmy Steve Community! 🎉\n\n` +
                        `You've received the **OG VILLAGERS** role.\n\n` +
                        `Thanks for being here from the beginning!`
                    );

                } catch (error) {
                    // User may have DMs disabled.
                    // This should NOT break the join process.
                    logger.debug(
                        `Could not DM OG member ${user.id}:`,
                        error
                    );
                }
            }

            // =====================================================
            // EXISTING AUTO-ROLE SYSTEM
            // =====================================================

            if (
                welcomeConfig?.roleIds &&
                welcomeConfig.roleIds.length > 0
            ) {
                const delay =
                    welcomeConfig.autoRoleDelay || 0;

                const singleRoleId =
                    welcomeConfig.roleIds[0];

                if (delay > 0) {
                    const timeout = setTimeout(
                        async () => {
                            const role =
                                guild.roles.cache.get(
                                    singleRoleId
                                );

                            if (role) {
                                await assignRoleSafely(
                                    member,
                                    role
                                );
                            }
                        },
                        delay * 1000
                    );

                    if (
                        typeof timeout.unref ===
                        'function'
                    ) {
                        timeout.unref();
                    }

                } else {
                    const role =
                        guild.roles.cache.get(
                            singleRoleId
                        );

                    if (role) {
                        await assignRoleSafely(
                            member,
                            role
                        );
                    }
                }
            }

            // =====================================================
            // VERIFICATION
            // =====================================================

            if (
                config?.verification?.enabled ||
                config?.verification?.autoVerify?.enabled
            ) {
                await handleVerification(
                    member,
                    guild,
                    config.verification,
                    member.client
                );
            }

            // =====================================================
            // MEMBER JOIN LOGGING
            // =====================================================

            try {
                await logEvent({
                    client: member.client,
                    guildId: guild.id,
                    eventType:
                        EVENT_TYPES.MEMBER_JOIN,

                    data: {
                        title: 'User joined',

                        lines: [
                            `**User:** ${user.toString()} (${user.displayName !== user.username ? `@${user.displayName}` : user.tag})`,
                            `**ID:** \`${user.id}\``,
                            `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
                            `**Members:** ${guild.memberCount}`
                        ],

                        quoted: false,

                        thumbnail:
                            user.displayAvatarURL({
                                dynamic: true
                            }),

                        userId: user.id
                    }
                });

            } catch (error) {
                logger.debug(
                    'Error logging member join:',
                    error
                );
            }

            // =====================================================
            // SERVER COUNTERS
            // =====================================================

            try {
                const counters =
                    await getServerCounters(
                        member.client,
                        guild.id
                    );

                for (const counter of counters) {
                    if (
                        counter &&
                        counter.type &&
                        counter.channelId &&
                        counter.enabled !== false
                    ) {
                        await updateCounter(
                            member.client,
                            guild,
                            counter
                        );
                    }
                }

            } catch (error) {
                logger.debug(
                    'Error updating counters on member join:',
                    error
                );
            }

            // =====================================================
            // RESTORE BIRTHDAY
            // =====================================================

            try {
                const backupKey =
                    `guild:${guild.id}:birthdays:left`;

                const backup =
                    (await member.client.db.get(
                        backupKey
                    )) || {};

                if (backup[user.id]) {
                    const {
                        month,
                        day
                    } = backup[user.id];

                    await dbSetBirthday(
                        member.client,
                        guild.id,
                        user.id,
                        month,
                        day
                    );

                    delete backup[user.id];

                    await member.client.db.set(
                        backupKey,
                        backup
                    );

                    logger.debug(
                        `Birthday restored for user ${user.id} in guild ${guild.id}`
                    );
                }

            } catch (error) {
                logger.debug(
                    'Error restoring birthday on member join:',
                    error
                );
            }

        } catch (error) {
            logger.error(
                'Error in guildMemberAdd event:',
                error
            );
        }
    }
};


// =============================================================
// VERIFICATION HANDLER
// =============================================================

async function handleVerification(
    member,
    guild,
    verificationConfig,
    client
) {
    const {
        autoVerifyOnJoin
    } = await import(
        '../services/verificationService.js'
    );

    try {
        const result =
            await autoVerifyOnJoin(
                client,
                guild,
                member,
                verificationConfig
            );

        if (result.autoVerified) {

            logger.info(
                'User auto-verified on join',
                {
                    guildId: guild.id,
                    userId: member.id,
                    userTag: member.user.tag,
                    roleName: result.roleName,
                    criteria: result.criteria
                }
            );

        } else {

            logger.debug(
                'User not auto-verified on join',
                {
                    guildId: guild.id,
                    userId: member.id,
                    reason: result.reason
                }
            );
        }

    } catch (error) {

        logger.error(
            'Error in auto-verification for member',
            {
                guildId: guild.id,
                userId: member.id,
                userTag: member.user.tag,
                error: error.message
            }
        );
    }
}


// =============================================================
// SAFE ROLE ASSIGNMENT
// =============================================================

async function assignRoleSafely(
    member,
    role
) {
    try {
        await member.roles.add(role);

    } catch (error) {

        logger.warn(
            `Failed to assign role ${role.id} to member ${member.id}:`,
            error
        );
    }
}
