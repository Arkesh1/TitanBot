import {
    getSponsorshipSettings,
    createSponsorshipChannel,
} from '../../../services/sponsorshipTicketService.js';

export default {
    name: 'sponsorship_inquiry_modal',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!settings.categoryId || !settings.staffRoleId) {
            return interaction.reply({
                content:
                    '❌ The sponsorship system has not been configured yet.',
                ephemeral: true,
            });
        }

        const data = {
            company: interaction.fields.getTextInputValue('company'),
            contact: interaction.fields.getTextInputValue('contact'),
            email: interaction.fields.getTextInputValue('email'),
            promotion: interaction.fields.getTextInputValue('promotion'),
            details: interaction.fields.getTextInputValue('details'),
        };

        await interaction.deferReply({
            ephemeral: true,
        });

        try {
            const channel = await createSponsorshipChannel(
                interaction,
                settings,
                data
            );

            await interaction.editReply({
                content:
                    `✅ Your sponsorship inquiry has been created: ${channel}`,
            });
        } catch (error) {
            console.error(
                'Error creating sponsorship ticket:',
                error
            );

            await interaction.editReply({
                content:
                    '❌ Something went wrong while creating your sponsorship ticket.',
            });
        }
    },
};
