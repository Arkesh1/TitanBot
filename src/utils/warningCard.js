import sharp from 'sharp';
import path from 'path';

export async function createWarningCard({ user }) {
    const backgroundPath = path.join(process.cwd(), 'src', 'warning-bg.png');

    // Exact avatar box measured from your mockup (in background pixels)
    const AVATAR_LEFT = 824;
    const AVATAR_TOP = 499;
    const AVATAR_SIZE = 187;

    // Glow settings
    const GLOW_COLOR = '#ff3b3b'; // warning red, try '#ffc400' or '#00e5ff'
    const GLOW_PAD = 45;          // extra room around the avatar for the glow
    const GLOW_BLUR = 12;         // higher = softer, wider glow

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

    // Soft glow that sits BEHIND the avatar
    const glowSize = AVATAR_SIZE + GLOW_PAD * 2;
    const glow = Buffer.from(`
        <svg width="${glowSize}" height="${glowSize}" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="${GLOW_BLUR}"/>
                </filter>
            </defs>
            <rect x="${GLOW_PAD}" y="${GLOW_PAD}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"
                  fill="none" stroke="${GLOW_COLOR}" stroke-width="14" filter="url(#blur)"/>
            <rect x="${GLOW_PAD}" y="${GLOW_PAD}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}"
                  fill="none" stroke="${GLOW_COLOR}" stroke-width="6" filter="url(#blur)"/>
        </svg>`);

    // Crisp border ON TOP of the avatar (drawn just inside its edges)
    const border = Buffer.from(`
        <svg width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="2" width="${AVATAR_SIZE - 4}" height="${AVATAR_SIZE - 4}"
                  fill="none" stroke="${GLOW_COLOR}" stroke-width="4"/>
            <rect x="5" y="5" width="${AVATAR_SIZE - 10}" height="${AVATAR_SIZE - 10}"
                  fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.5"/>
        </svg>`);

    return sharp(backgroundPath)
        .composite([
            { input: glow, left: AVATAR_LEFT - GLOW_PAD, top: AVATAR_TOP - GLOW_PAD },
            { input: avatar, left: AVATAR_LEFT, top: AVATAR_TOP },
            { input: border, left: AVATAR_LEFT, top: AVATAR_TOP },
        ])
        .png()
        .toBuffer();
}
