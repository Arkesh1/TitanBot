import {
    getSponsorshipSettings,
    getSponsorshipOwnerId,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_reopen',

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
                    '❌ You do not have permission to reopen sponsorship tickets.',
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
