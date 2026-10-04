import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send a message as Iron Golem')
        .setDefaultMemberPermissions(
            PermissionFlagsBits.ManageGuild
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content:
                    '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    '❌ You need the Manage Server permission.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const modal = new ModalBuilder()
            .setCustomId('say_message_modal')
            .setTitle('Send Message');

        const messageInput = new TextInputBuilder()
            .setCustomId('say_message')
            .setLabel('Message')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder(
                'Type your message here...'
            )
            .setRequired(true)
            .setMaxLength(2000);

        const row = new ActionRowBuilder()
            .addComponents(messageInput);

        modal.addComponents(row);

        await interaction.showModal(modal);

        try {
            const modalInteraction =
                await interaction.awaitModalSubmit({
                    time: 5 * 60 * 1000,

                    filter: (submitted) =>
                        submitted.customId ===
                            'say_message_modal' &&
                        submitted.user.id ===
                            interaction.user.id,
                });

            const message =
                modalInteraction.fields.getTextInputValue(
                    'say_message'
                );

            if (!message.trim()) {
                return modalInteraction.reply({
                    content:
                        '❌ Message cannot be empty.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (!interaction.channel) {
                return modalInteraction.reply({
                    content:
                        '❌ This channel is unavailable.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            await interaction.channel.send({
                content: message,
            });

            await modalInteraction.reply({
                content: '✅ Message sent.',
                flags: MessageFlags.Ephemeral,
            });
        } catch (error) {
            if (error?.code === 'InteractionCollectorError') {
                return;
            }

            console.error(
                'Error in /say command:',
                error
            );
        }
    },
};
