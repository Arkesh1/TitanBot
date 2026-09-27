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

    /*
     * ---------------------------------------------------------
     * USER AVATAR
     * ---------------------------------------------------------
     */

    const avatarUrl = user.displayAvatarURL({
        extension: 'png',
        size: 512,
        forceStatic: true,
    });

    const response = await fetch(avatarUrl);

    if (!response.ok) {
        throw new Error(
            `Failed to download avatar: ${response.status}`
        );
    }

    const avatarBuffer = Buffer.from(
        await response.arrayBuffer()
    );

    // Large centered avatar
    const avatarSize = 390;

    const avatar = await sharp(avatarBuffer)
        .resize(avatarSize, avatarSize, {
            fit: 'cover',
            position: 'centre',
        })
        .composite([
            {
                input: Buffer.from(`
                    <svg
                        width="${avatarSize}"
                        height="${avatarSize}"
                        xmlns="http://www.w3.org/2000/svg"
                    >
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

    /*
     * ---------------------------------------------------------
     * TEXT
     * ---------------------------------------------------------
     */

    const displayName = truncate(
        user.globalName || user.username,
        24
    );

    const serverName = truncate(
        guild.name,
        30
    );

    /*
     * ---------------------------------------------------------
     * FILMY STEVE WELCOME CARD
     *
     * Orange -> blue gradient
     * Minecraft-inspired pixel details
     * Large centered avatar
     * Clean typography
     * ---------------------------------------------------------
     */

    const svg = `
<svg
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
    xmlns="http://www.w3.org/2000/svg"
>

    <defs>

        <!-- Main Filmy Steve gradient -->
        <linearGradient
            id="backgroundGradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
        >
            <stop
                offset="0%"
                stop-color="#A94712"
            />

            <stop
                offset="55%"
                stop-color="#B95416"
            />

            <stop
                offset="100%"
                stop-color="#07596D"
            />
        </linearGradient>

        <!-- Soft dark overlay -->
        <linearGradient
            id="darkOverlay"
            x1="0%"
            y1="0%"
            x2="0%"
            y2="100%"
        >
            <stop
                offset="0%"
                stop-color="#000000"
                stop-opacity="0.08"
            />

            <stop
                offset="100%"
                stop-color="#000000"
                stop-opacity="0.20"
            />
        </linearGradient>

        <!-- Avatar shadow -->
        <filter
            id="avatarShadow"
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
        >
            <feDropShadow
                dx="0"
                dy="12"
                stdDeviation="14"
                flood-color="#000000"
                flood-opacity="0.45"
            />
        </filter>

        <!-- Small text shadow -->
        <filter
            id="textShadow"
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
        >
            <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2"
                flood-color="#000000"
                flood-opacity="0.35"
            />
        </filter>

    </defs>


    <!-- =====================================================
         BACKGROUND
         ===================================================== -->

    <rect
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        rx="36"
        fill="url(#backgroundGradient)"
    />

    <rect
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        rx="36"
        fill="url(#darkOverlay)"
    />


    <!-- =====================================================
         MINECRAFT-INSPIRED PIXEL DETAILS
         ===================================================== -->

    <!-- Top-left orange pixel cluster -->

    <rect
        x="48"
        y="48"
        width="22"
        height="22"
        fill="#F27A24"
        opacity="0.95"
    />

    <rect
        x="74"
        y="48"
        width="22"
        height="22"
        fill="#D95F18"
        opacity="0.9"
    />

    <rect
        x="48"
        y="74"
        width="48"
        height="22"
        fill="#B84D12"
        opacity="0.9"
    />

    <rect
        x="100"
        y="48"
        width="22"
        height="48"
        fill="#8F3D11"
        opacity="0.8"
    />


    <!-- Top-right blue pixel cluster -->

    <rect
        x="1078"
        y="48"
        width="22"
        height="22"
        fill="#19A8C4"
        opacity="0.95"
    />

    <rect
        x="1104"
        y="48"
        width="48"
        height="22"
        fill="#087E9B"
        opacity="0.9"
    />

    <rect
        x="1104"
        y="74"
        width="22"
        height="48"
        fill="#07596D"
        opacity="0.9"
    />

    <rect
        x="1078"
        y="74"
        width="22"
        height="22"
        fill="#0B6F87"
        opacity="0.85"
    />


    <!-- Bottom-left pixel cluster -->

    <rect
        x="48"
        y="580"
        width="22"
        height="22"
        fill="#D95F18"
        opacity="0.8"
    />

    <rect
        x="74"
        y="580"
        width="48"
        height="22"
        fill="#8F3D11"
        opacity="0.75"
    />

    <rect
        x="48"
        y="606"
        width="48"
        height="22"
        fill="#6F3215"
        opacity="0.75"
    />


    <!-- Bottom-right blue pixel cluster -->

    <rect
        x="1078"
        y="580"
        width="48"
        height="22"
        fill="#087E9B"
        opacity="0.8"
    />

    <rect
        x="1104"
        y="606"
        width="48"
        height="22"
        fill="#07596D"
        opacity="0.85"
    />

    <rect
        x="1078"
        y="606"
        width="22"
        height="22"
        fill="#0A7892"
        opacity="0.8"
    />


    <!-- =====================================================
         FILMY STEVE BRANDING
         ===================================================== -->

    <text
        x="600"
        y="72"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="34"
        font-weight="900"
        letter-spacing="4"
        fill="#FFFFFF"
        filter="url(#textShadow)"
    >
        FILMY STEVE
    </text>

    <text
        x="600"
        y="101"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="13"
        font-weight="700"
        letter-spacing="6"
        fill="#FFFFFF"
        opacity="0.72"
    >
        COMMUNITY
    </text>


    <!-- Small divider -->

    <rect
        x="530"
        y="120"
        width="140"
        height="3"
        rx="2"
        fill="#FFFFFF"
        opacity="0.55"
    />


    <!-- =====================================================
         AVATAR SHADOW
         ===================================================== -->

    <circle
        cx="600"
        cy="325"
        r="208"
        fill="#000000"
        opacity="0.28"
        filter="url(#avatarShadow)"
    />


    <!-- =====================================================
         AVATAR WHITE RING
         ===================================================== -->

    <circle
        cx="600"
        cy="325"
        r="203"
        fill="none"
        stroke="#FFFFFF"
        stroke-width="9"
        opacity="0.96"
    />


    <!-- Slight orange inner ring -->

    <circle
        cx="600"
        cy="325"
        r="194"
        fill="none"
        stroke="#F27A24"
        stroke-width="3"
        opacity="0.85"
    />


    <!-- =====================================================
         AVATAR
         ===================================================== -->

    <image
        href="data:image/png;base64,${avatar.toString('base64')}"
        x="405"
        y="130"
        width="${avatarSize}"
        height="${avatarSize}"
    />


    <!-- =====================================================
         WELCOME TEXT
         ===================================================== -->

    <text
        x="600"
        y="520"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="38"
        font-weight="800"
        fill="#FFFFFF"
        filter="url(#textShadow)"
    >
        WELCOME, ${escapeXml(displayName)}!
    </text>


    <text
        x="600"
        y="553"
        text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="18"
        font-weight="600"
        letter-spacing="1"
        fill="#FFFFFF"
        opacity="0.82"
    >
        TO ${escapeXml(serverName).toUpperCase()}
    </text>


    <!-- =====================================================
         BOTTOM PIXEL ACCENT
         ===================================================== -->

    <rect
        x="520"
        y="590"
        width="32"
        height="8"
        fill="#FFFFFF"
        opacity="0.35"
    />

    <rect
        x="558"
        y="590"
        width="64"
        height="8"
        fill="#FFFFFF"
        opacity="0.65"
    />

    <rect
        x="628"
        y="590"
        width="32"
        height="8"
        fill="#FFFFFF"
        opacity="0.35"
    />

</svg>
`;

    return sharp(Buffer.from(svg))
        .png()
        .toBuffer();
}
