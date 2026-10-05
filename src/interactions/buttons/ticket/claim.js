import {
    getSponsorshipSettings,
        isSponsorshipStaff,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_claim',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

if (!isSponsorshipStaff(interaction, settings)) {
    return interaction.reply({
        content: '❌ You do not have permission to use this button.',
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
