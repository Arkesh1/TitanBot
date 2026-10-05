import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';

import {
    saveSponsorshipSettings,
    createSponsorshipPanel,
} from '../../services/sponsorshipTicketService.js';

export default {
    data: new SlashCommandBuilder()
        .setName('sponsorship')
        .setDescription('Manage sponsorship inquiries')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand((subcommand) =>
            subcommand
                .setName('setup')
                .setDescription('Set up the sponsorship inquiry system')

                .addChannelOption((option) =>
                    option
                        .setName('panel_channel')
                        .setDescription(
                            'Channel where the sponsorship panel will be posted'
                        )
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)
                )

                .addChannelOption((option) =>
                    option
                        .setName('category')
                        .setDescription(
                            'Category where open sponsorship tickets are created'
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )

                .addChannelOption((option) =>
                    option
                        .setName('closed_category')
                        .setDescription(
                            'Category where closed sponsorship tickets are moved'
                        )
                        .addChannelTypes(ChannelType.GuildCategory)
                        .setRequired(true)
                )

                .addRoleOption((option) =>
                    option
                        .setName('staff_role')
                        .setDescription(
                            'Role that can access sponsorship tickets'
                        )
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const panelChannel =
            interaction.options.getChannel('panel_channel');

        const category =
            interaction.options.getChannel('category');

        const closedCategory =
            interaction.options.getChannel('closed_category');

        const staffRole =
            interaction.options.getRole('staff_role');

        try {
            const panel = await panelChannel.send(
                createSponsorshipPanel()
            );

            const saved = await saveSponsorshipSettings(
                interaction.client,
                interaction.guild.id,
                {
                    panelChannelId: panelChannel.id,
                    panelMessageId: panel.id,
                    categoryId: category.id,
                    closedCategoryId: closedCategory.id,
                    staffRoleId: staffRole.id,
                }
            );

            if (!saved) {
                await panel.delete().catch(() => {});

                throw new Error(
                    'Could not save sponsorship settings.'
                );
            }

            await interaction.reply({
                content:
                    `✅ **Sponsorship system configured!**\n\n` +
                    `📋 Panel: ${panelChannel}\n` +
                    `📁 Open Category: ${category}\n` +
                    `📁 Closed Category: ${closedCategory}\n` +
                    `👥 Staff Role: ${staffRole}`,
                ephemeral: true,
            });

        } catch (error) {
            console.error(
                'Error setting up sponsorship system:',
                error
            );

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content:
                        '❌ Failed to set up the sponsorship system.',
                    ephemeral: true,
                });
            }
        }
    },
};
