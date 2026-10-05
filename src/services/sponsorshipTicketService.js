import {
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import { logger } from '../utils/logger.js';

const SETTINGS_PREFIX = 'guild:';

function getSettingsKey(guildId) {
    return `${SETTINGS_PREFIX}${guildId}:sponsorship-settings`;
}

export async function getSponsorshipSettings(client, guildId) {
    try {
        const data = await client.db.get(getSettingsKey(guildId));

        if (!data || typeof data !== 'object') {
            return {
                panelChannelId: null,
                panelMessageId: null,
                categoryId: null,
                closedCategoryId: null,
                staffRoleId: null,
            };
        }

        return {
            panelChannelId: data.panelChannelId || null,
            panelMessageId: data.panelMessageId || null,
            categoryId: data.categoryId || null,
            closedCategoryId: data.closedCategoryId || null,
            staffRoleId: data.staffRoleId || null,
        };
    } catch (error) {
        logger.error('Error loading sponsorship settings:', error);

        return {
            panelChannelId: null,
            panelMessageId: null,
            categoryId: null,
            closedCategoryId: null,
            staffRoleId: null,
        };
    }
}

export async function saveSponsorshipSettings(client, guildId, settings) {
    try {
        await client.db.set(
            getSettingsKey(guildId),
            {
                panelChannelId: settings.panelChannelId || null,
                panelMessageId: settings.panelMessageId || null,
                categoryId: settings.categoryId || null,
                closedCategoryId: settings.closedCategoryId || null,
                staffRoleId: settings.staffRoleId || null,
            }
        );

        return true;
    } catch (error) {
        logger.error('Error saving sponsorship settings:', error);
        return false;
    }
}

export function createSponsorshipPanel() {
    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🤝 Sponsorship Inquiries')
        .setDescription(
            'Interested in working with **Filmy Steve**?\n\n' +
            'For sponsorships, brand deals, product promotions, or other business inquiries, click the button below and submit your details.'
        )
        .addFields({
            name: '📋 What happens next?',
            value:
                'Our team will review your inquiry and contact you through the private sponsorship ticket.',
        })
        .setFooter({
            text: 'Filmy Steve • Sponsorships',
        });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sponsorship_create')
            .setLabel('Sponsorship Inquiry')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🤝')
    );

    return {
        embeds: [embed],
        components: [row],
    };
}

export function createOpenSponsorshipControls() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sponsorship_claim')
            .setLabel('Claim')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🙋'),

        new ButtonBuilder()
            .setCustomId('sponsorship_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒')
    );
}

export function createClosedSponsorshipControls() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('sponsorship_reopen')
            .setLabel('Reopen')
            .setStyle(ButtonStyle.Success)
            .setEmoji('🔓'),

        new ButtonBuilder()
            .setCustomId('sponsorship_delete')
            .setLabel('Delete')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🗑️')
    );
}

export function getSponsorshipOwnerId(channel) {
    const topic = channel.topic || '';

    const match = topic.match(
        /sponsorship-owner:(\d+)/
    );

    return match ? match[1] : null;
}

export async function createSponsorshipChannel(
    interaction,
    settings,
    data
) {
    const guild = interaction.guild;

    const channelName =
        `sponsor-${interaction.user.username}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 80);

    const permissionOverwrites = [
        {
            id: guild.roles.everyone.id,
            deny: [
                PermissionFlagsBits.ViewChannel,
            ],
        },
        {
            id: interaction.user.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
            ],
        },
    ];

    if (settings.staffRoleId) {
        permissionOverwrites.push({
            id: settings.staffRoleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
                PermissionFlagsBits.EmbedLinks,
                PermissionFlagsBits.ManageMessages,
            ],
        });
    }

    const channel = await guild.channels.create({
        name: channelName,
        type: ChannelType.GuildText,
        parent: settings.categoryId || null,
        permissionOverwrites,
        topic:
            `sponsorship-owner:${interaction.user.id} | ` +
            `Sponsorship inquiry by ${interaction.user.tag}`,
    });

    const embed = new EmbedBuilder()
        .setColor(0xf39c12)
        .setTitle('🤝 Sponsorship Inquiry')
        .setDescription(
            'Thank you for your interest in working with **Filmy Steve**.\n\n' +
            'Our team will review the information below and get back to you.'
        )
        .addFields(
            {
                name: '🏢 Company / Brand',
                value: data.company,
                inline: true,
            },
            {
                name: '👤 Contact Name',
                value: data.contact,
                inline: true,
            },
            {
                name: '📧 Email',
                value: data.email,
                inline: false,
            },
            {
                name: '📢 What would you like promoted?',
                value: data.promotion,
                inline: false,
            },
            {
                name: '💼 Campaign Details / Budget',
                value: data.details,
                inline: false,
            }
        )
        .setFooter({
            text: `Submitted by ${interaction.user.tag}`,
        })
        .setTimestamp();

    const controls = createOpenSponsorshipControls();

    await channel.send({
        content: `${interaction.user}`,
        embeds: [embed],
        components: [controls],
    });

    return channel;
}
