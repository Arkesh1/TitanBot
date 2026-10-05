import {
    getSponsorshipSettings,
    getSponsorshipOwnerId,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_close',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (
            !settings.staffRoleId ||
            !interaction.member.roles.cache.has(settings.staffRoleId)
        ) {
            return interaction.reply({
                content:
                    '❌ You do not have permission to close sponsorship tickets.',
                ephemeral: true,
            });
        }

        const ownerId = getSponsorshipOwnerId(
            interaction.channel
        );

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

        await interaction.message.edit({
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
