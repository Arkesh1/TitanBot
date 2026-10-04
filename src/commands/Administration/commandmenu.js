import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ChannelSelectMenuBuilder,
    ChannelType,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';

import {
    getCommandSettings,
    setCommandSettings,
} from '../../services/commandChannelService.js';

const COMMANDS_PER_PAGE = 20;

function getCommands(client) {
    return [...client.commands.values()]
        .filter((command) => command?.data?.name)
        .sort((a, b) =>
            a.data.name.localeCompare(b.data.name)
        );
}

function buildCommandMenu(commands, page) {
    const start = page * COMMANDS_PER_PAGE;
    const pageCommands = commands.slice(
        start,
        start + COMMANDS_PER_PAGE
    );

    return new StringSelectMenuBuilder()
        .setCustomId(`commandmenu_select:${page}`)
        .setPlaceholder('Select a command...')
        .addOptions(
            pageCommands.map((command) => ({
                label: `/${command.data.name}`.substring(0, 100),
                description: (
                    command.data.description ||
                    'No description'
                ).substring(0, 100),
                value: command.data.name,
            }))
        );
}

function buildPageButtons(page, totalPages) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('commandmenu_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page <= 0),

        new ButtonBuilder()
            .setCustomId('commandmenu_page')
            .setLabel(`${page + 1} / ${totalPages}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),

        new ButtonBuilder()
            .setCustomId('commandmenu_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(page >= totalPages - 1),

        new ButtonBuilder()
            .setCustomId('commandmenu_close')
            .setLabel('Close')
            .setStyle(ButtonStyle.Danger)
    );
}

function buildMainEmbed(page, totalPages) {
    return new EmbedBuilder()
        .setTitle('⚙️ Command Manager')
        .setDescription(
            'Select a command below to configure its visibility and channel.'
        )
        .addFields({
            name: 'Current page',
            value: `**${page + 1} / ${totalPages}**`,
            inline: true,
        })
        .setColor(0x5865f2);
}

export default {
    data: new SlashCommandBuilder()
        .setName('commandmenu')
        .setDescription('Manage command visibility and channels')


    async execute(interaction, guildConfig, client) {
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

        const commands = getCommands(client);

        if (commands.length === 0) {
            return interaction.reply({
                content: '❌ No commands were found.',
                flags: MessageFlags.Ephemeral,
            });
        }

        let page = 0;
        const totalPages = Math.max(
            1,
            Math.ceil(commands.length / COMMANDS_PER_PAGE)
        );

        await interaction.reply({
            embeds: [
                buildMainEmbed(page, totalPages),
            ],
            components: [
                new ActionRowBuilder().addComponents(
                    buildCommandMenu(commands, page)
                ),
                buildPageButtons(page, totalPages),
            ],
            flags: MessageFlags.Ephemeral,
        });

        const response =
            await interaction.fetchReply();

        const collector =
            response.createMessageComponentCollector({
                time: 10 * 60 * 1000,
                filter: (componentInteraction) =>
                    componentInteraction.user.id ===
                    interaction.user.id,
            });

        collector.on('collect', async (componentInteraction) => {
            try {
                if (
                    componentInteraction.customId ===
                    'commandmenu_close'
                ) {
                    collector.stop('closed');

                    await componentInteraction.update({
                        content:
                            '✅ Command manager closed.',
                        embeds: [],
                        components: [],
                    });

                    return;
                }

                if (
                    componentInteraction.customId ===
                    'commandmenu_prev'
                ) {
                    page = Math.max(0, page - 1);

                    await componentInteraction.update({
                        embeds: [
                            buildMainEmbed(
                                page,
                                totalPages
                            ),
                        ],
                        components: [
                            new ActionRowBuilder().addComponents(
                                buildCommandMenu(
                                    commands,
                                    page
                                )
                            ),
                            buildPageButtons(
                                page,
                                totalPages
                            ),
                        ],
                    });

                    return;
                }

                if (
                    componentInteraction.customId ===
                    'commandmenu_next'
                ) {
                    page = Math.min(
                        totalPages - 1,
                        page + 1
                    );

                    await componentInteraction.update({
                        embeds: [
                            buildMainEmbed(
                                page,
                                totalPages
                            ),
                        ],
                        components: [
                            new ActionRowBuilder().addComponents(
                                buildCommandMenu(
                                    commands,
                                    page
                                )
                            ),
                            buildPageButtons(
                                page,
                                totalPages
                            ),
                        ],
                    });

                    return;
                }

                if (
                    componentInteraction.customId.startsWith(
                        'commandmenu_select:'
                    )
                ) {
                    const commandName =
                        componentInteraction.values[0];

                    const settings =
                        await getCommandSettings(
                            client,
                            interaction.guildId,
                            commandName
                        );

                    const command =
                        client.commands.get(
                            commandName
                        );

                    const embed =
                        new EmbedBuilder()
                            .setTitle(
                                `⚙️ /${commandName}`
                            )
                            .setDescription(
                                command?.data?.description ||
                                    'No description'
                            )
                            .addFields(
                                {
                                    name: 'Visibility',
                                    value:
                                        settings.visibility ===
                                        'private'
                                            ? '🔴 Private'
                                            : '🟢 Public',
                                    inline: true,
                                },
                                {
                                    name: 'Channel',
                                    value:
                                        settings.channelId
                                            ? `<#${settings.channelId}>`
                                            : '🌐 All channels',
                                    inline: true,
                                }
                            )
                            .setColor(0x5865f2);

                    const visibilityRow =
                        new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(
                                    `commandmenu_visibility:${commandName}`
                                )
                                .setPlaceholder(
                                    'Set visibility...'
                                )
                                .addOptions(
                                    {
                                        label: 'Public',
                                        description:
                                            'Visible to everyone',
                                        value: 'public',
                                    },
                                    {
                                        label: 'Private',
                                        description:
                                            'Restricted command',
                                        value: 'private',
                                    }
                                )
                        );

                    const channelRow =
                        new ActionRowBuilder().addComponents(
                            new ChannelSelectMenuBuilder()
                                .setCustomId(
                                    `commandmenu_channel:${commandName}`
                                )
                                .setPlaceholder(
                                    'Select allowed channel...'
                                )
                                .setChannelTypes(
                                    ChannelType.GuildText,
                                    ChannelType.GuildAnnouncement
                                )
                        );

                    const actionRow =
                        new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId(
                                    `commandmenu_all:${commandName}`
                                )
                                .setLabel(
                                    'Allow All Channels'
                                )
                                .setStyle(
                                    ButtonStyle.Secondary
                                ),

                            new ButtonBuilder()
                                .setCustomId(
                                    `commandmenu_back`
                                )
                                .setLabel('Back')
                                .setStyle(
                                    ButtonStyle.Secondary
                                )
                        );

                    await componentInteraction.update({
                        embeds: [embed],
                        components: [
                            visibilityRow,
                            channelRow,
                            actionRow,
                        ],
                    });

                    return;
                }

                if (
                    componentInteraction.customId ===
                    'commandmenu_back'
                ) {
                    await componentInteraction.update({
                        embeds: [
                            buildMainEmbed(
                                page,
                                totalPages
                            ),
                        ],
                        components: [
                            new ActionRowBuilder().addComponents(
                                buildCommandMenu(
                                    commands,
                                    page
                                )
                            ),
                            buildPageButtons(
                                page,
                                totalPages
                            ),
                        ],
                    });

                    return;
                }

                if (
                    componentInteraction.customId.startsWith(
                        'commandmenu_visibility:'
                    )
                ) {
                    const commandName =
                        componentInteraction.customId.split(
                            ':'
                        )[1];

                    const visibility =
                        componentInteraction.values[0];

                    const current =
                        await getCommandSettings(
                            client,
                            interaction.guildId,
                            commandName
                        );

                    await setCommandSettings(
                        client,
                        interaction.guildId,
                        commandName,
                        {
                            channelId:
                                current.channelId,
                            visibility,
                        }
                    );

                    await componentInteraction.reply({
                        content:
                            `✅ **/${commandName}** is now **${
                                visibility === 'private'
                                    ? 'Private'
                                    : 'Public'
                            }**.`,
                        flags: MessageFlags.Ephemeral,
                    });

                    return;
                }

                if (
                    componentInteraction.customId.startsWith(
                        'commandmenu_channel:'
                    )
                ) {
                    const commandName =
                        componentInteraction.customId.split(
                            ':'
                        )[1];

                    const channelId =
                        componentInteraction.values[0];

                    const current =
                        await getCommandSettings(
                            client,
                            interaction.guildId,
                            commandName
                        );

                    await setCommandSettings(
                        client,
                        interaction.guildId,
                        commandName,
                        {
                            channelId,
                            visibility:
                                current.visibility,
                        }
                    );

                    await componentInteraction.reply({
                        content:
                            `✅ **/${commandName}** can now only be used in <#${channelId}>.`,
                        flags: MessageFlags.Ephemeral,
                    });

                    return;
                }

                if (
                    componentInteraction.customId.startsWith(
                        'commandmenu_all:'
                    )
                ) {
                    const commandName =
                        componentInteraction.customId.split(
                            ':'
                        )[1];

                    const current =
                        await getCommandSettings(
                            client,
                            interaction.guildId,
                            commandName
                        );

                    await setCommandSettings(
                        client,
                        interaction.guildId,
                        commandName,
                        {
                            channelId: null,
                            visibility:
                                current.visibility,
                        }
                    );

                    await componentInteraction.reply({
                        content:
                            `✅ **/${commandName}** now works in **all channels**.`,
                        flags: MessageFlags.Ephemeral,
                    });

                    return;
                }
            } catch (error) {
                console.error(
                    'Command menu interaction error:',
                    error
                );

                if (
                    !componentInteraction.replied &&
                    !componentInteraction.deferred
                ) {
                    await componentInteraction.reply({
                        content:
                            '❌ Something went wrong while updating the command.',
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => {});
                }
            }
        });

        collector.on('end', async () => {
            await interaction.editReply({
                components: [],
            }).catch(() => {});
        });
    },
};
