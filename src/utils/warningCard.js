import sharp from 'sharp';
import path from 'path';

export async function createWarningCard({ user }) {
    const width = 1200;
    const height = 675;

    const backgroundPath = path.join(process.cwd(), 'src', 'warning-bg.png');

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

    // ---- Tweak these to line the avatar up with the villager's head ----
    const headSize = 210;        // px, avatar width/height
    const headCenterX = 0.685;   // 0-1, fraction of card width
    const headCenterY = 0.60;    // 0-1, fraction of card height
    // --------------------------------------------------------------------

    const avatar = await sharp(avatarBuffer)
        .resize(headSize, headSize, {
            fit: 'cover',
            position: 'centre',
            kernel: 'nearest', // optional: gives a blocky, Minecraft-style look
        })
        .png()
        .toBuffer();

    const headLeft = Math.round(width * headCenterX - headSize / 2);
    const headTop = Math.round(height * headCenterY - headSize / 2);

    return sharp(backgroundPath)
        .resize(width, height, {
            fit: 'cover',       // keeps aspect ratio, crops instead of stretching
            position: 'centre',
        })
        .composite([{ input: avatar, left: headLeft, top: headTop }])
        .png()
        .toBuffer();
}
