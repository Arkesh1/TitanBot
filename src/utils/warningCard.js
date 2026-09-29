import sharp from 'sharp';
import path from 'path';

export async function createWarningCard({ user }) {
    const backgroundPath = path.join(process.cwd(), 'src', 'warning-bg.png');

    // Match the canvas to the background's own aspect ratio (no stretch, no crop)
    const bgMeta = await sharp(backgroundPath).metadata();
    const width = 1200;
    const height = Math.round(width * (bgMeta.height / bgMeta.width));

    const avatarUrl = user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true,
    });

    const response = await fetch(avatarUrl);
    if (!response.ok) {
        throw new Error(`Failed to download Discord avatar: ${response.status}`);
    }
    const avatarBuffer = Buffer.from(await response.arrayBuffer());

    // Avatar placement, as fractions of the full background image
    const headCenterX = 0.71;    // horizontal center of the villager's head
    const headCenterY = 0.56;    // vertical center of the villager's head
    const headSizeRatio = 0.16;  // avatar size relative to image width

    const headSize = Math.round(width * headSizeRatio);

    const avatar = await sharp(avatarBuffer)
        .resize(headSize, headSize, {
            fit: 'cover',
            position: 'centre',
            kernel: 'nearest', // blocky, Minecraft-style look
        })
        .png()
        .toBuffer();

    const headLeft = Math.round(width * headCenterX - headSize / 2);
    const headTop = Math.round(height * headCenterY - headSize / 2);

    return sharp(backgroundPath)
        .resize(width, height) // same ratio as the source, so nothing distorts
        .composite([{ input: avatar, left: headLeft, top: headTop }])
        .png()
        .toBuffer();
}
