import sharp from 'sharp';
import path from 'path';

/**
 * Creates the warning card for a Discord warning.
 *
 * The background image should be:
 * src/assets/warning-bg.png
 *
 * The target user's Discord avatar is placed
 * onto the empty Minecraft player/villager head.
 */
export async function createWarningCard({ user }) {
    const width = 1200;
    const height = 675;

    const backgroundPath = path.join(
        process.cwd(),
        'src',
        'warning-bg.png'
    );

    const avatarUrl = user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true,
    });

    const response = await fetch(avatarUrl);

    if (!response.ok) {
        throw new Error(
            `Failed to download Discord avatar: ${response.status}`
        );
    }

    const avatarBuffer = Buffer.from(
        await response.arrayBuffer()
    );

    /*
     * Minecraft-style square head.
     * Adjust this size after seeing the first result.
     */
    const headSize = 190;

    const avatar = await sharp(avatarBuffer)
        .resize(headSize, headSize, {
            fit: 'cover',
            position: 'centre',
        })
        .png()
        .toBuffer();

    /*
     * Position of the empty head in warning-bg.png.
     * These values can be adjusted once we see the final result.
     */
    const headLeft = 650;
    const headTop = 470;

    return await sharp(backgroundPath)
        .resize(width, height, {
            fit: 'cover',
            position: 'centre',
        })
        .composite([
            {
                input: avatar,
                left: headLeft,
                top: headTop,
            },
        ])
        .png()
        .toBuffer();
}
