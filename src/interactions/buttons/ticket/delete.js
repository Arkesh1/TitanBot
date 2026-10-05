import {
    getSponsorshipSettings,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_delete',

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
