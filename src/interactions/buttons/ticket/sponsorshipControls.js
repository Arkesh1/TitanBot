import {
    getSponsorshipSettings,
    getSponsorshipOwnerId,
} from '../../../services/sponsorshipTicketService.js';

async function isStaff(interaction, settings) {
    return (
        settings.staffRoleId &&
        interaction.member.roles.cache.has(settings.staffRoleId)
    );
}

export const sponsorshipClaimHandler = {
    name: 'sponsorship_claim',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content:
                    '❌ You do not have permission to claim sponsorship tickets.',
                ephemeral: true,
            });
        }

        await interaction.channel.send(
            `🙋 **${interaction.user} claimed this sponsorship inquiry.**`
        );

        await interaction.reply({
            content: '✅ Sponsorship ticket claimed.',
            ephemeral: true,
        });
    },
};

export const sponsorshipCloseHandler = {
    name: 'sponsorship_close',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content:
                    '❌ You do not have permission to close sponsorship tickets.',
                ephemeral: true,
            });
        }

        const ownerId = getSponsorshipOwnerId(interaction.channel);

        if (ownerId) {
            await interaction.channel.permissionOverwrites.edit(
                ownerId,
                {
                    ViewChannel: false,
                    SendMessages: false,
                }
            );
        }

        if (settings.closedCategoryId) {
            await interaction.channel.setParent(
                settings.closedCategoryId,
                {
                    lockPermissions: false,
                }
            );
        }

        if (!interaction.channel.name.startsWith('closed-')) {
            await interaction.channel.setName(
                `closed-${interaction.channel.name.replace(/^sponsor-/, '')}`
            );
        }

        const message = interaction.message;

        await message.edit({
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            custom_id: 'sponsorship_reopen',
                            label: 'Reopen',
                            style: 3,
                            emoji: {
                                name: '🔓',
                            },
                        },
                        {
                            type: 2,
                            custom_id: 'sponsorship_delete',
                            label: 'Delete',
                            style: 4,
                            emoji: {
                                name: '🗑️',
                            },
                        },
                    ],
                },
            ],
        });

        await interaction.reply({
            content: '🔒 Sponsorship ticket closed.',
        });
    },
};

export const sponsorshipReopenHandler = {
    name: 'sponsorship_reopen',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content:
                    '❌ You do not have permission to reopen sponsorship tickets.',
                ephemeral: true,
            });
        }

        const ownerId = getSponsorshipOwnerId(interaction.channel);

        if (ownerId) {
            await interaction.channel.permissionOverwrites.edit(
                ownerId,
                {
                    ViewChannel: true,
                    SendMessages: true,
                    ReadMessageHistory: true,
                    AttachFiles: true,
                    EmbedLinks: true,
                }
            );
        }

        if (settings.categoryId) {
            await interaction.channel.setParent(
                settings.categoryId,
                {
                    lockPermissions: false,
                }
            );
        }

        if (interaction.channel.name.startsWith('closed-')) {
            await interaction.channel.setName(
                interaction.channel.name.replace(/^closed-/, 'sponsor-')
            );
        }

        await interaction.message.edit({
            components: [
                {
                    type: 1,
                    components: [
                        {
                            type: 2,
                            custom_id: 'sponsorship_claim',
                            label: 'Claim',
                            style: 1,
                            emoji: {
                                name: '🙋',
                            },
                        },
                        {
                            type: 2,
                            custom_id: 'sponsorship_close',
                            label: 'Close',
                            style: 4,
                            emoji: {
                                name: '🔒',
                            },
                        },
                    ],
                },
            ],
        });

        await interaction.reply({
            content: '🔓 Sponsorship ticket reopened.',
        });
    },
};

export const sponsorshipDeleteHandler = {
    name: 'sponsorship_delete',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content:
                    '❌ You do not have permission to delete sponsorship tickets.',
                ephemeral: true,
            });
        }

        await interaction.reply({
            content: '🗑️ Deleting sponsorship ticket...',
            ephemeral: true,
        });

        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 1000);
    },
};
