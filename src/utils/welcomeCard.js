import sharp from 'sharp';

function escapeXml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function truncate(value, maxLength) {
    const text = String(value || '').trim();
    return text.length > maxLength
        ? `${text.slice(0, maxLength - 1)}…`
        : text;
}

export async function createWelcomeCard({
    user,
    guild,
    welcomeMessage,
}) {
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

    const avatarSize = 190;

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

    const displayName = truncate(
        user.globalName || user.username,
        28
    );

    const serverName = truncate(
        guild.name,
        32
    );

    const message = truncate(
        welcomeMessage || "We're glad you're here!",
        80
    );

    const svg = `
<svg
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    xmlns="http://www.w3.org/2000/svg"
>

    <defs>

        <linearGradient id="background"
            x1="0" y1="0"
            x2="1" y2="1">

            <stop
                offset="0%"
                stop-color="#101214"
            />

            <stop
                offset="100%"
                stop-color="#1b1f23"
            />

        </linearGradient>

        <linearGradient id="orange"
            x1="0" y1="0"
            x2="1" y2="0">

            <stop
                offset="0%"
                stop-color="#ff6500"
            />

            <stop
                offset="100%"
                stop-color="#ff9d32"
            />

        </linearGradient>

        <linearGradient id="cyan"
            x1="0" y1="0"
            x2="1" y2="0">

            <stop
                offset="0%"
                stop-color="#00b7d9"
            />

            <stop
                offset="100%"
                stop-color="#00e5ff"
            />

        </linearGradient>

        <filter id="shadow">
            <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="18"
                flood-color="#000000"
                flood-opacity="0.45"
            />
        </filter>

    </defs>

    <!-- Background -->
    <rect
        width="1200"
        height="675"
        rx="42"
        fill="url(#background)"
    />

    <!-- Orange accent -->
    <path
        d="
            M0 0
            H330
            C255 125 250 255 325 350
            C390 435 365 560 260 675
            H0
            Z
        "
        fill="url(#orange)"
    />

    <!-- Cyan accent -->
    <path
        d="
            M1200 675
            H930
            C1000 550 1015 445 935 365
            C855 285 880 145 985 0
            H1200
            Z
        "
        fill="url(#cyan)"
    />

    <!-- Main card -->
    <rect
        x="145"
        y="55"
        width="910"
        height="565"
        rx="48"
        fill="#181b1e"
        filter="url(#shadow)"
    />

    <!-- Brand -->
    <text
        x="600"
        y="112"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="24"
        font-weight="700"
        letter-spacing="4"
        fill="#ff7518"
    >
        FILMY STEVE COMMUNITY
    </text>

    <!-- Avatar outer ring -->
    <circle
        cx="600"
        cy="270"
        r="108"
        fill="#0d0f10"
        stroke="#ffffff"
        stroke-width="9"
    />

    <!-- Avatar -->
    <image
        href="data:image/png;base64,${avatar.toString('base64')}"
        x="505"
        y="175"
        width="190"
        height="190"
    />

    <!-- Welcome -->
    <text
        x="600"
        y="425"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="42"
        font-weight="700"
        fill="#ffffff"
    >
        Welcome, ${escapeXml(displayName)}!
    </text>

    <!-- Server -->
    <text
        x="600"
        y="465"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="22"
        fill="#aeb4ba"
    >
        to ${escapeXml(serverName)}
    </text>

    <!-- Welcome message -->
    <text
        x="600"
        y="515"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="20"
        fill="#e1e4e7"
    >
        ${escapeXml(message)}
    </text>

</svg>
`;

    return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}
