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
    const svg = `
        <svg
            width="${width}"
            height="${height}"
            viewBox="0 0 ${width} ${height}"
            xmlns="http://www.w3.org/2000/svg"
        >
            <!-- Orange background -->
            <rect
                width="${width}"
                height="${height}"
                fill="#ff6a00"
            />

            <!-- Avatar shadow -->
            <circle
                cx="600"
                cy="337"
                r="218"
                fill="#000000"
                opacity="0.25"
            />

            <!-- White avatar border -->
            <circle
                cx="600"
                cy="337"
                r="207"
                fill="#ffffff"
            />

            <!-- User avatar -->
            <image
                href="data:image/png;base64,${avatar.toString('base64')}"
                x="400"
                y="137"
                width="400"
                height="400"
            />
        </svg>
    `;

    return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}
