import {
    getSponsorshipSettings,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_claim',

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
