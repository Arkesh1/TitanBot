import sharp from 'sharp';
import path from 'path';

/**
 * Creates the Filmy Steve welcome card.
 *
 * Background:
 * src/assets/welcome-bg.png
 *
 * The background already contains:
 * - Welcome to Filmy Steve branding
 * - Minecraft-style environment
 * - Orange/blue color scheme
 * - Avatar placeholder
 * - Circular orange/cyan rim
 * - Community text
 *
 * This function only adds the user's Discord avatar.
 */

export async function createWelcomeCard({ user }) {
    // ---------------------------------------------------------
    // CARD SIZE
    // ---------------------------------------------------------

    const width = 1200;
    const height = 675;

    // ---------------------------------------------------------
    // BACKGROUND IMAGE
    // ---------------------------------------------------------

    const backgroundPath = path.join(
        process.cwd(),
        'src',
        'welcome_bg.png'
    );

    // ---------------------------------------------------------
    // DOWNLOAD DISCORD AVATAR
    // ---------------------------------------------------------

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

    // ---------------------------------------------------------
    // CREATE CIRCULAR AVATAR
    // ---------------------------------------------------------

    /*
     * The background was designed with a large circular
     * avatar area in the center.
     *
     * 300px leaves the existing orange/cyan ring visible.
     */

    const avatarSize = 300;

    const avatar = await sharp(avatarBuffer)
        .resize(avatarSize, avatarSize, {
            fit: 'cover',
            position: 'centre',
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg
                        width="${avatarSize}"
                        height="${avatarSize}"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <circle
                            cx="${avatarSize / 2}"
                            cy="${avatarSize / 2}"
                            r="${avatarSize / 2}"
                            fill="white"
                        />
                    </svg>
                `),
                blend: 'dest-in',
            },
        ])
        .png()
        .toBuffer();

    // ---------------------------------------------------------
    // PREPARE BACKGROUND
    // ---------------------------------------------------------

    const background = sharp(backgroundPath)
        .resize(width, height, {
            fit: 'cover',
            position: 'centre',
        });

    // ---------------------------------------------------------
    // AVATAR POSITION
    // ---------------------------------------------------------

    /*
     * Background coordinates:
     *
     * Original image: 1672 × 941
     *
     * Central avatar circle:
     * approximately centered around:
     *
     * X = 836
     * Y = 526
     *
     * After resizing to 1200 × 675:
     *
     * X ≈ 600
     * Y ≈ 377
     *
     * So a 300px avatar is placed at:
     *
     * X = 450
     * Y = 227
     */

    const avatarLeft = 450;
    const avatarTop = 227;

    // ---------------------------------------------------------
    // COMPOSITE AVATAR ONTO BACKGROUND
    // ---------------------------------------------------------

    const finalImage = await background
        .composite([
            {
                input: avatar,
                left: avatarLeft,
                top: avatarTop,
            },
        ])
        .png()
        .toBuffer();

    return finalImage;
}
