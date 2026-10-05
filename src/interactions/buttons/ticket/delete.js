import {
    getSponsorshipSettings,
        isSponsorshipStaff,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_delete',

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

        await interaction.reply({
            content: '🗑️ Deleting sponsorship ticket...',
            ephemeral: true,
        });

        setTimeout(async () => {
            await interaction.channel.delete().catch(() => {});
        }, 1000);
    },
};
