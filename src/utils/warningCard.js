import sharp from 'sharp';
import path from 'path';

export async function createWarningCard({ user }) {
    const backgroundPath = path.join(process.cwd(), 'src', 'warning-bg.png');

    // Avatar box on the 905x905 background (villager's head)
    const AVATAR_LEFT = 625;
    const AVATAR_TOP = 475;
    const AVATAR_SIZE = 184;

    // Look settings
    const PIXELS = 64;         // texture resolution: 32 = chunky, 64 = detailed
    const BRIGHTNESS = 0.95;   // <1 darkens to match the scene
    const SATURATION = 0.95;

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

    // Downscale then upscale with nearest-neighbour for a block-texture look
    const small = await sharp(avatarBuffer)
        .resize(PIXELS, PIXELS, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();

    const avatar = await sharp(small)
        .resize(AVATAR_SIZE, AVATAR_SIZE, { kernel: 'nearest' })
        .modulate({ brightness: BRIGHTNESS, saturation: SATURATION })
        .png()
        .toBuffer();

    // Lighting overlay: tint, top-to-bottom shade, edge vignette, thin dark outline
    const shading = Buffer.from(`
        <svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stop-color="#fff" stop-opacity="0.10"/>
                    <stop offset="1" stop-color="#000" stop-opacity="0.28"/>
                </linearGradient>
                <radialGradient id="v" cx="50%" cy="50%" r="75%">
                    <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
                    <stop offset="1" stop-color="#000" stop-opacity="0.35"/>
                </radialGradient>
            </defs>
            <rect width="100%" height="100%" fill="#b07a5a" fill-opacity="0.12"/>
            <rect width="100%" height="100%" fill="url(#g)"/>
            <rect width="100%" height="100%" fill="url(#v)"/>
            <rect x="1" y="1" width="${AVATAR_SIZE - 2}" height="${AVATAR_SIZE - 2}"
                  fill="none" stroke="#000" stroke-opacity="0.45" stroke-width="2"/>
        </svg>`);

    return sharp(backgroundPath)
        .composite([
            { input: avatar, left: AVATAR_LEFT, top: AVATAR_TOP },
            { input: shading, left: AVATAR_LEFT, top: AVATAR_TOP },
        ])
        .png()
        .toBuffer();
}
