
import { logger } from '../utils/logger.js';

const YOUTUBE_CHANNEL_ID = 'UCq0QaP-KqB5h3K0Ofqp6-oQ';

const YOUTUBE_FEED_URL =
    `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

const TIME_ZONE = 'Asia/Kolkata';

const CHECK_START_HOUR = 18; // 6:00 PM IST
const CHECK_END_HOUR = 22;   // 10:00 PM IST (exclusive)
const CHECK_INTERVAL = 15 * 60 * 1000;

const REQUEST_TIMEOUT = 15 * 1000;

const YOUTUBE_LAST_VIDEO_KEY =
    'youtube:filmy-steve:last-video-id';

const NOTIFICATION_CHANNEL_NAME = '▶️│latest-video';

const sleep = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

async function fetchFeed() {
    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
    );

    try {
        const response = await fetch(YOUTUBE_FEED_URL, {
            signal: controller.signal,
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (compatible; FilmySteveBot/1.0)',
                Accept:
                    'application/atom+xml, application/xml, text/xml, */*',
            },
        });

        if (!response.ok) {
            throw new Error(
                `YouTube RSS request failed: HTTP ${response.status}`
            );
        }

        return await response.text();
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(
                `YouTube RSS request timed out after ${REQUEST_TIMEOUT / 1000} seconds`
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

function decodeXml(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;|&#39;/g, "'")
        .replace(/&#(\d+);/g, (_, code) =>
            String.fromCodePoint(Number(code))
        )
        .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
            String.fromCodePoint(parseInt(code, 16))
        );
}

function extractLatestVideo(xml) {
    // YouTube's Atom feed normally lists the newest video first.
    // Only the first entry is processed.
    const entryMatch = xml.match(
        /<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/
    );

    if (!entryMatch) {
        return null;
    }

    const entry = entryMatch[1];

    const getTag = (tag) => {
        const escapedTag = tag.replace(':', '\\:');

        const match = entry.match(
            new RegExp(
                `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`
            )
        );

        if (!match) {
            return null;
        }

        return decodeXml(
            match[1]
                .replace(/<!\[CDATA\[|\]\]>/g, '')
                .trim()
        );
    };

    const videoId = getTag('yt:videoId');
    const title = getTag('title');
    const published = getTag('published');

    const alternateLink = entry.match(
        /<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhref=["']([^"']+)["'])[^>]*\/?>/i
    );

    const anyLink = entry.match(
        /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\/?>/i
    );

    const videoUrl =
        (alternateLink && alternateLink[1]) ||
        (anyLink && anyLink[1]) ||
        (videoId
            ? `https://www.youtube.com/watch?v=${videoId}`
            : null);

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
    let sentSuccessfully = false;

    for (const guild of client.guilds.cache.values()) {
        const channel = guild.channels.cache.find(
            (item) =>
                item.name === NOTIFICATION_CHANNEL_NAME &&
                item.isTextBased() &&
                typeof item.send === 'function'
        );

        if (!channel) {
            logger.warn(
                `YouTube notification channel "${NOTIFICATION_CHANNEL_NAME}" not found in ${guild.name}.`
            );
            continue;
        }

        try {
            await channel.send({
                content: '📺 **NEW FILMY STEVE VIDEO!**',
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
                            text: 'Filmy Steve • YouTube',
                        },
                    },
                ],
            });

            sentSuccessfully = true;

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

    return sentSuccessfully;
}

export async function checkYouTubeUploads(client) {
    const xml = await fetchFeed();
    const latestVideo = extractLatestVideo(xml);

    if (!latestVideo) {
        throw new Error(
            'YouTube feed responded, but no valid video entry was found.'
        );
    }

    const lastVideoId = await client.db.get(
        YOUTUBE_LAST_VIDEO_KEY
    );

    // First successful check: save the current video without
    // announcing an existing upload.
    if (!lastVideoId) {
        await client.db.set(
            YOUTUBE_LAST_VIDEO_KEY,
            latestVideo.videoId
        );

        logger.info(
            `YouTube notifications initialized with: ${latestVideo.title}`
        );

        return;
    }

    // Nothing new has been uploaded.
    if (latestVideo.videoId === lastVideoId) {
        logger.info('YouTube check successful. No new video.');
        return;
    }

    // Announce the new upload.
    const sentSuccessfully = await sendNotification(
        client,
        latestVideo
    );

    // Save the ID only if at least one notification was sent.
    // This allows a later check to retry if Discord sending fails.
    if (sentSuccessfully) {
        await client.db.set(
            YOUTUBE_LAST_VIDEO_KEY,
            latestVideo.videoId
        );

        logger.info(
            `Latest Filmy Steve video announced: ${latestVideo.title}`
        );
    } else {
        throw new Error(
            'New video detected, but notification could not be sent to any server. Will retry at the next scheduled check.'
        );
    }
}

// Get the current date and time in IST.
function getISTNow() {
    return new Date(Date.now() + 330 * 60 * 1000);
}

// Calculate the next 15-minute boundary between 6 PM and 10 PM IST.
function getDelayUntilNextCheck() {
    const nowIST = getISTNow();

    const year = nowIST.getUTCFullYear();
    const month = nowIST.getUTCMonth();
    const day = nowIST.getUTCDate();
    const hour = nowIST.getUTCHours();

    // Before 6 PM: wait until 6 PM today.
    if (hour < CHECK_START_HOUR) {
        return Date.UTC(
            year, month, day,
            CHECK_START_HOUR, 0, 0
        ) - nowIST.getTime();
    }

    // At or after 10 PM: wait until 6 PM tomorrow.
    if (hour >= CHECK_END_HOUR) {
        return Date.UTC(
            year, month, day + 1,
            CHECK_START_HOUR, 0, 0
        ) - nowIST.getTime();
    }

    // During the checking window, schedule the next
    // quarter-hour boundary.
    const currentMinute = nowIST.getUTCMinutes();
    const currentSecond = nowIST.getUTCSeconds();
    const currentMs = nowIST.getUTCMilliseconds();

    const minutesToNextBoundary =
        15 - (currentMinute % 15);

    return (
        minutesToNextBoundary * 60 * 1000 -
        currentSecond * 1000 -
        currentMs
    );
}

async function runScheduledCheck(client) {
    try {
        logger.info('Running scheduled YouTube feed check.');

        await checkYouTubeUploads(client);
    } catch (error) {
        logger.error(
            'Scheduled YouTube feed check failed:',
            error
        );
    }
}

export function startYouTubeNotifications(client) {
    let stopped = false;
    let scheduleTimer;
    let running = false;

    const scheduleNextCheck = () => {
        if (stopped) return;

        const delay = getDelayUntilNextCheck();

        logger.info(
            `Next YouTube check scheduled in ${Math.ceil(delay / 60000)} minutes. Checks run every 15 minutes from 6:00 PM to 10:00 PM IST.`
        );

        scheduleTimer = setTimeout(async () => {
            if (stopped) return;

            const nowIST = getISTNow();
            const hour = nowIST.getUTCHours();

            if (
                hour >= CHECK_START_HOUR &&
                hour < CHECK_END_HOUR &&
                !running
            ) {
                running = true;

                try {
                    await runScheduledCheck(client);
                } finally {
                    running = false;
                }
            }

            // Always schedule the next check regardless of
            // whether the previous check succeeded or failed.
            if (!stopped) {
                scheduleNextCheck();
            }
        }, delay);
    };

    scheduleNextCheck();

    logger.info(
        'YouTube notifications started. Daily schedule: 6:00 PM–10:00 PM IST, every 15 minutes. Checks continue after errors and successful uploads.'
    );

    // Call this function if the bot needs to stop the scheduler.
    return () => {
        stopped = true;
        clearTimeout(scheduleTimer);
    };
}
