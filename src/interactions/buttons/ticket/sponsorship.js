import {
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} from 'discord.js';

export default {
    name: 'sponsorship_create',

    async execute(interaction) {
        const modal = new ModalBuilder()
            .setCustomId('sponsorship_inquiry_modal')
            .setTitle('Sponsorship Inquiry');

        const companyInput = new TextInputBuilder()
            .setCustomId('company')
            .setLabel('Company / Brand')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your company or brand name')
            .setRequired(true)
            .setMaxLength(100);

        const contactInput = new TextInputBuilder()
            .setCustomId('contact')
            .setLabel('Contact Name')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Your name')
            .setRequired(true)
            .setMaxLength(100);

        const emailInput = new TextInputBuilder()
            .setCustomId('email')
            .setLabel('Email')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('business@example.com')
            .setRequired(true)
            .setMaxLength(150);

        const promotionInput = new TextInputBuilder()
            .setCustomId('promotion')
            .setLabel('What would you like promoted?')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Product, service, campaign, etc.')
            .setRequired(true)
            .setMaxLength(1000);

        const detailsInput = new TextInputBuilder()
            .setCustomId('details')
            .setLabel('Campaign Details / Budget')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Timeline, budget, requirements, etc.')
            .setRequired(true)
            .setMaxLength(1500);

        modal.addComponents(
            new ActionRowBuilder().addComponents(companyInput),
            new ActionRowBuilder().addComponents(contactInput),
            new ActionRowBuilder().addComponents(emailInput),
            new ActionRowBuilder().addComponents(promotionInput),
            new ActionRowBuilder().addComponents(detailsInput)
        );

        await interaction.showModal(modal);
    },
};
