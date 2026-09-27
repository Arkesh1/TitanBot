import sharp from 'sharp';

export async function createWelcomeCard({ user }) {
    const width = 1200;
    const height = 675;

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

    // Large avatar
    const avatarSize = 400;

    // Crop avatar into a circle
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

    // Create a clean orange background
    const background = sharp({
        create: {
            width,
            height,
            channels: 4,
            background: {
                r: 205,
                g: 82,
                b: 0,
                alpha: 1,
            },
        },
    });

    // Add a subtle dark-orange shadow behind avatar
    const shadow = Buffer.from(`
        <svg width="440" height="440">
            <circle
                cx="220"
                cy="220"
                r="210"
                fill="#000000"
                opacity="0.22"
            />
        </svg>
    `);

    // White circular border
    const border = Buffer.from(`
        <svg width="420" height="420">
            <circle
                cx="210"
                cy="210"
                r="202"
                fill="none"
                stroke="#ffffff"
                stroke-width="10"
            />
        </svg>
    `);

    return background
        .composite([
            // Shadow
            {
                input: shadow,
                left: 380,
                top: 117,
            },

            // White border
            {
                input: border,
                left: 390,
                top: 127,
            },

            // Avatar
            {
                input: avatar,
                left: 400,
                top: 137,
            },
        ])
        .png()
        .toBuffer();
}
