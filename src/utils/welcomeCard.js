import sharp from 'sharp';

export async function createWelcomeCard({ user }) {
    const width = 1200;
    const height = 675;

    // Download the user's Discord avatar
    const avatarUrl = user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true,
    });

    const response = await fetch(avatarUrl);

    if (!response.ok) {
        throw new Error(`Failed to download avatar: ${response.status}`);
    }

    const avatarBuffer = Buffer.from(
        await response.arrayBuffer()
    );

    // BIG avatar
    const avatarSize = 400;

    // Make avatar circular
    const avatar = await sharp(avatarBuffer)
        .resize(avatarSize, avatarSize, {
            fit: 'cover',
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg width="${avatarSize}" height="${avatarSize}">
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

    // Simple orange background
const backgroundSvg = `
<svg
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    xmlns="http://www.w3.org/2000/svg"
>
    <defs>
        <linearGradient
            id="filmyGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
        >
            <stop offset="0%" stop-color="#C85A16"/>
            <stop offset="62%" stop-color="#C85A16"/>
            <stop offset="100%" stop-color="#087E9B"/>
        </linearGradient>
    </defs>

    <rect
        width="${width}"
        height="${height}"
        fill="url(#filmyGradient)"
    />
</svg>
`;

const background = sharp(Buffer.from(backgroundSvg));
}
