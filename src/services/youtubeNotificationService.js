import { logger } from '../utils/logger.js';

const YOUTUBE_CHANNEL_ID =
    'UCq0QaP-KqB5h3K0Ofqp6-oQ';

const YOUTUBE_FEED_URL =
    `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

const CHECK_INTERVAL = 2 * 60 * 1000;

const YOUTUBE_LAST_VIDEO_KEY =
    'youtube:filmy-steve:last-video-id';

const NOTIFICATION_CHANNEL_NAME =
    '📺│youtube';

async function fetchFeed() {
    const response = await fetch(
        YOUTUBE_FEED_URL
    );

    if (!response.ok) {
        throw new Error(
            `YouTube RSS request failed: ${response.status}`
        );
    }

    return response.text();
}

function decodeXml(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractLatestVideo(xml) {
    const entryMatch = xml.match(
        /<entry>([\s\S]*?)<\/entry>/
    );

    if (!entryMatch) {
        return null;
    }

    const entry = entryMatch[1];

    const getTag = (tag) => {
        const match = entry.match(
            new RegExp(
                `<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`
            )
        );

        return match
            ? decodeXml(
                match[1]
                    .replace(
                        /<!\[CDATA\[|\]\]>/g,
                        ''
                    )
                    .trim()
            )
            : null;
    };

    const videoId =
        getTag('yt:videoId');

    const title =
        getTag('title');

    const published =
        getTag('published');

    const linkMatch =
        entry.match(
            /<link[^>]+href="([^"]+)"/
        );

    const videoUrl =
        linkMatch?.[1] ||
        `https://www.youtube.com/watch?v=${videoId}`;

    if (!videoId || !title) {
        return null;
    }

    return {
        videoId,
        title,
        published,
        videoUrl,
    };
}

async function sendNotification(client, video) {
    for (const guild of client.guilds.cache.values()) {
        const channel =
            guild.channels.cache.find(
                (channel) =>
                    channel.name ===
                    NOTIFICATION_CHANNEL_NAME
            );

        if (!channel) {
            continue;
        }

        try {
            await channel.send({
                content:
                    '📺 **NEW FILMY STEVE VIDEO!**',

                embeds: [
                    {
                        title: video.title,
                        url: video.videoUrl,

                        description:
                            '🎬 A new Filmy Steve video is live!',

                        image: {
                            url:
                                `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`,
                        },

                        color: 0xff6600,

                        footer: {
                            text:
                                'Filmy Steve • YouTube',
                        },
                    },
                ],
            });

            logger.info(
                `YouTube notification sent in ${guild.name}: ${video.title}`
            );

        } catch (error) {
            logger.error(
                `Failed to send YouTube notification in ${guild.name}:`,
                error
            );
        }
    }
}

export async function checkYouTubeUploads(client) {
    try {
        const xml =
            await fetchFeed();

        const latestVideo =
            extractLatestVideo(xml);

        if (!latestVideo) {
            logger.warn(
                'No video found in YouTube feed.'
            );

            return;
        }

        const lastVideoId =
            await client.db.get(
                YOUTUBE_LAST_VIDEO_KEY
            );

        /*
         * First run:
         * Save the current video without
         * sending a notification for an old upload.
         */
        if (!lastVideoId) {
            await client.db.set(
                YOUTUBE_LAST_VIDEO_KEY,
                latestVideo.videoId
            );

            logger.info(
                `YouTube notification initialized with: ${latestVideo.title}`
            );

            return;
        }

        /*
         * Nothing new.
         */
        if (
            latestVideo.videoId ===
            lastVideoId
        ) {
            return;
        }

        /*
         * New upload detected.
         */
        await sendNotification(
            client,
            latestVideo
        );

        await client.db.set(
            YOUTUBE_LAST_VIDEO_KEY,
            latestVideo.videoId
        );

        logger.info(
            `New Filmy Steve video detected: ${latestVideo.title}`
        );

    } catch (error) {
        logger.error(
            'YouTube notification error:',
            error
        );
    }
}

export function startYouTubeNotifications(client) {
    checkYouTubeUploads(client);

    setInterval(
        () => checkYouTubeUploads(client),
        CHECK_INTERVAL
    );

    logger.info(
        'YouTube notification system started.'
    );
}
