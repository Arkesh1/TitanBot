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

    const avatarBuffer = Buffer.from(
        await response.arrayBuffer()
    );

    // Size of the user's Minecraft-style head
    const headSize = 190;

    const avatar = await sharp(avatarBuffer)
        .resize(headSize, headSize, {
            fit: 'cover',
            position: 'centre',
        })
        .png()
        .toBuffer();

    // Position of the empty character head
    const headLeft = 650;
    const headTop = 470;

    const finalImage = await sharp(backgroundPath)
        .resize(width, height, {
            fit: 'fill',
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
