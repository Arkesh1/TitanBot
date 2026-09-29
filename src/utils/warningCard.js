import sharp from 'sharp';
import path from 'path';

export async function createWarningCard({ user }) {
    const backgroundPath = path.join(process.cwd(), 'src', 'warning-bg.png');

    // Avatar box on the 905x905 background (villager's head)
    const AVATAR_LEFT = 625;
    const AVATAR_TOP = 475;
    const AVATAR_SIZE = 184;

    const BORDER_COLOR = '#ff3b3b';

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

    const avatar = await sharp(avatarBuffer)
        .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
        .png()
        .toBuffer();

    // Crisp border on top of the avatar
    const border = Buffer.from(`
        <svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="${AVATAR_SIZE - 4}" height="${AVATAR_SIZE - 4}"
                  fill="none" stroke="${BORDER_COLOR}" stroke-width="4"/>
            <rect x="5" y="5" width="${AVATAR_SIZE - 10}" height="${AVATAR_SIZE - 10}"
                  fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5"/>
        </svg>`);

    return sharp(backgroundPath)
        .composite([
            { input: avatar, left: AVATAR_LEFT, top: AVATAR_TOP },
            { input: border, left: AVATAR_LEFT, top: AVATAR_TOP },
        ])
        .png()
        .toBuffer();
}
