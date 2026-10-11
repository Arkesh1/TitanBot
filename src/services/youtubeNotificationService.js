
import { logger } from '../utils/logger.js';

const YOUTUBE_CHANNEL_ID = 'UCq0QaP-KqB5h3K0Ofqp6-oQ';

const YOUTUBE_FEED_URL =
    `https://www.youtube.com/feeds/videos.xml?channel_id=${YOUTUBE_CHANNEL_ID}`;

const TIME_ZONE = 'Asia/Kolkata';
const CHECK_HOUR = 18;
const CHECK_MINUTE = 0;

const RETRY_INTERVAL = 2 * 60 * 1000;
const REQUEST_TIMEOUT = 15 * 1000;
const MAX_RETRY_WINDOW = 6 * 60 * 60 * 1000;

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
    // Deliberately process only the first entry.
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

    // First successful check: initialize without announcing an old video.
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

    // No new upload: do nothing.
    if (latestVideo.videoId === lastVideoId) {
        logger.info('YouTube check successful. No new video.');
        return;
    }

    // Only the newest feed entry is ever announced.
    await sendNotification(client, latestVideo);

    await client.db.set(
        YOUTUBE_LAST_VIDEO_KEY,
        latestVideo.videoId
    );

    logger.info(
        `Latest Filmy Steve video detected: ${latestVideo.title}`
    );
}

function getDelayUntilNextCheck() {
    const now = new Date();

    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(now);

    const values = Object.fromEntries(
        parts.map(({ type, value }) => [type, value])
    );

    // 18:00 IST is 12:30 UTC. India does not observe daylight saving time.
    let nextCheck = Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day),
        CHECK_HOUR - 5,
        CHECK_MINUTE - 30,
        0
    );

    if (nextCheck <= now.getTime()) {
        nextCheck += 24 * 60 * 60 * 1000;
    }

    return nextCheck - now.getTime();
}

async function runDailyCheck(client) {
    const deadline = Date.now() + MAX_RETRY_WINDOW;
    let attempt = 0;

    while (Date.now() < deadline) {
        attempt += 1;

        try {
            logger.info(
                `YouTube feed check attempt ${attempt}.`
            );

            await checkYouTubeUploads(client);

            logger.info(
                'YouTube feed check succeeded. Daily retry loop finished.'
            );

            return;
        } catch (error) {
            logger.error(
                `YouTube feed check attempt ${attempt} failed:`,
                error
            );
        }

        const remaining = deadline - Date.now();

        if (remaining <= 0) {
            break;
        }

        await sleep(Math.min(RETRY_INTERVAL, remaining));
    }

    logger.warn(
        'YouTube feed remained unavailable for 6 hours. Next attempt is scheduled for 6:00 PM IST tomorrow.'
    );
}

export function startYouTubeNotifications(client) {
    let stopped = false;
    let scheduleTimer;

    const scheduleNextCheck = () => {
        if (stopped) return;

        const delay = getDelayUntilNextCheck();

        logger.info(
            `Next YouTube feed check scheduled in ${Math.ceil(delay / 60000)} minutes (6:00 PM IST).`
        );

        scheduleTimer = setTimeout(async () => {
            await runDailyCheck(client);
            scheduleNextCheck();
        }, delay);
    };

    scheduleNextCheck();

    logger.info(
        'YouTube notifications started. Daily check: 6:00 PM IST; retry interval: 2 minutes; maximum retry window: 6 hours.'
    );

    // Optional cleanup if your application needs to stop this scheduler.
    return () => {
        stopped = true;
        clearTimeout(scheduleTimer);
    };
}
