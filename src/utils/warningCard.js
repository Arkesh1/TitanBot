import sharp from 'sharp';
import path from 'path';

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

    const avatarBuffer = Buffer.from(await response.arrayBuffer());

    // Size of the user's Minecraft-style head (slightly smaller so it fits the villager)
    const headSize = 160;

    const avatar = await sharp(avatarBuffer)
        .resize(headSize, headSize, {
            fit: 'cover',
            position: 'centre',
        })
        .png()
        .toBuffer();

    // Position of the villager's head (tuned for the new non-stretched background)
    const headLeft = 780;
    const headTop = 340;

    const finalImage = await sharp(backgroundPath)
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

    return finalImage;
}
