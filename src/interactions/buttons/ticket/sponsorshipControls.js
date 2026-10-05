import {
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';

import {
    getSponsorshipSettings,
} from '../../../services/sponsorshipTicketService.js';

async function isStaff(interaction, settings) {
    return (
        settings.staffRoleId &&
        interaction.member.roles.cache.has(settings.staffRoleId)
    );
}

export const sponsorshipClaimHandler = {
    name: 'sponsorship_claim',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content: '❌ You do not have permission to claim sponsorship tickets.',
                ephemeral: true,
            });
        }

        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                ViewChannel: false,
            }
        );

        await interaction.channel.send(
            `🙋 **${interaction.user} claimed this sponsorship inquiry.**`
        );

        await interaction.reply({
            content: '✅ Sponsorship ticket claimed.',
            ephemeral: true,
        });
    },
};

export const sponsorshipCloseHandler = {
    name: 'sponsorship_close',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content: '❌ You do not have permission to close sponsorship tickets.',
                ephemeral: true,
            });
        }

        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                ViewChannel: false,
            }
        );

        await interaction.channel.permissionOverwrites.edit(
            interaction.user.id,
            {
                ViewChannel: false,
                SendMessages: false,
            }
        );

        await interaction.channel.setName(
            `closed-${interaction.channel.name.replace(/^sponsor-/, '')}`
        );

        await interaction.reply({
            content: '🔒 Sponsorship ticket closed.',
        });
    },
};

export const sponsorshipReopenHandler = {
    name: 'sponsorship_reopen',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content: '❌ You do not have permission to reopen sponsorship tickets.',
                ephemeral: true,
            });
        }

        await interaction.channel.permissionOverwrites.edit(
            interaction.guild.roles.everyone,
            {
                ViewChannel: false,
            }
        );

        await interaction.channel.setName(
            interaction.channel.name.replace(/^closed-/, 'sponsor-')
        );

        await interaction.reply({
            content: '🔓 Sponsorship ticket reopened.',
        });
    },
};

export const sponsorshipDeleteHandler = {
    name: 'sponsorship_delete',

    async execute(interaction) {
        const settings = await getSponsorshipSettings(
            interaction.client,
            interaction.guild.id
        );

        if (!(await isStaff(interaction, settings))) {
            return interaction.reply({
                content: '❌ You do not have permission to delete sponsorship tickets.',
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
