
async execute(interaction) {
    await interaction.deferReply({
        flags: MessageFlags.Ephemeral,
    });

    try {
        const result = await checkYouTubeUploads(
            interaction.client
        );

        if (result.status === 'initialized') {
            await interaction.editReply(
                '✅ YouTube API connected. The latest video ID has been saved; existing videos were not announced.'
            );
        } else if (result.count > 0) {
            await interaction.editReply(
                `✅ YouTube check complete. Announced ${result.count} new video(s).`
            );
        } else {
            await interaction.editReply(
                '✅ YouTube check complete. No new uploads found.'
            );
        }
    } catch (error) {
        logger.error('Manual YouTube check failed:', error);

        await interaction.editReply(
            `❌ YouTube check failed: ${error.message}`
        );
    }
}
