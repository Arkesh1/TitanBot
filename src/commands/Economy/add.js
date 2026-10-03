import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';

import EconomyService from '../../services/economyService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('add')
        .setDescription('Add Emeralds to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand) =>
            subcommand
                .setName('emerald')
                .setDescription('Give Emeralds to a user')
                .addIntegerOption((option) =>
                    option
                        .setName('quantity')
                        .setDescription('Amount of Emeralds to give')
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addUserOption((option) =>
                    option
                        .setName('user')
                        .setDescription('User who receives the Emeralds')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ This command can only be used in a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (
            !interaction.member.permissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content: '❌ You need the Manage Server permission.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const quantity = interaction.options.getInteger('quantity');
        const user = interaction.options.getUser('user');

        try {
            const newBalance = await EconomyService.addEmeralds(
                interaction.client,
                interaction.guildId,
                user.id,
                quantity,
                `admin-add:${interaction.user.id}`
            );

   await interaction.reply({
    content:
        `Added **${quantity} Emeralds** to ${user}.\n` +
        `New balance: **${newBalance} Emeralds**`,
    flags: MessageFlags.Ephemeral,
});
        } catch (error) {
            await interaction.reply({
                content: `❌ Failed to add Emeralds.\n\`${error.message || 'Unknown error'}\``,
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};
