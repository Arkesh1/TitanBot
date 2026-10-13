
import { logger } from '../utils/logger.js';

const YOUTUBE_CHANNEL_ID = 'UCq0QaP-KqB5h3K0Ofqp6-oQ';

// YouTube uploads playlist IDs normally begin with UU
// followed by the channel ID without its initial UC.
const YOUTUBE_UPLOADS_PLAYLIST_ID =
    `UU${YOUTUBE_CHANNEL_ID.slice(2)}`;

const TIME_ZONE = 'Asia/Kolkata';
const CHECK_START_HOUR = 18;
const CHECK_END_HOUR = 22;

const CHECK_INTERVAL = 15 * 60 * 1000;
const REQUEST_TIMEOUT = 15 * 1000;
const MAX_RESULTS = 50;

const YOUTUBE_LAST_VIDEO_KEY =
    'youtube:filmy-steve:last-video-id';

const NOTIFICATION_CHANNEL_NAME = '▶️│latest-video';

function getISTNow() {
    return new Date(Date.now() + 330 * 60 * 1000);
}

async function fetchLatestVideos() {
    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
        throw new Error(
            'Missing YOUTUBE_API_KEY environment variable.'
        );
    }

    const params = new URLSearchParams({
        part: 'snippet,contentDetails',
        playlistId: YOUTUBE_UPLOADS_PLAYLIST_ID,
        maxResults: String(MAX_RESULTS),
        key: apiKey,
    });

    const controller = new AbortController();

    const timeout = setTimeout(
        () => controller.abort(),
        REQUEST_TIMEOUT
    );

    try {
        const response = await fetch(
            `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
            {
                signal: controller.signal,
                headers: {
                    Accept: 'application/json',
                },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            const apiError =
                data?.error?.message ||
                `HTTP ${response.status}`;

            throw new Error(
                `YouTube Data API error: ${apiError}`
            );
        }

        if (!Array.isArray(data.items)) {
            throw new Error(
                'YouTube API returned an unexpected response.'
            );
        }

        return data.items
            .map((item) => {
                const videoId =
                    item.contentDetails?.videoId ||
                    item.snippet?.resourceId?.videoId;

                const title = item.snippet?.title;

                if (!videoId || !title) {
                    return null;
                }

                return {
                    videoId,
                    title,
                    published:
                        item.contentDetails?.videoPublishedAt ||
                        item.snippet?.publishedAt ||
                        null,
                    videoUrl:
                        `https://www.youtube.com/watch?v=${videoId}`,
                };
            })
            .filter(Boolean);
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error(
                `YouTube API timed out after ${REQUEST_TIMEOUT / 1000} seconds.`
            );
        }

        throw error;
    } finally {
        clearTimeout(timeout);
    }
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
    const videos = await fetchLatestVideos();

    if (videos.length === 0) {
        throw new Error(
            'The uploads playlist returned no usable videos.'
        );
    }

    const lastVideoId = await client.db.get(
        YOUTUBE_LAST_VIDEO_KEY
    );

    // First run: initialize the saved ID without announcing
    // older videos that were already on the channel.
    if (!lastVideoId) {
        await client.db.set(
            YOUTUBE_LAST_VIDEO_KEY,
            videos[0].videoId
        );

        logger.info(
            `YouTube notifications initialized with: ${videos[0].title}`
        );

        return {
            status: 'initialized',
            count: 0,
        };
    }

    // API results are newest first. Find videos newer than
    // the saved ID, then announce them oldest first.
    const previousIndex = videos.findIndex(
        (video) => video.videoId === lastVideoId
    );

    if (previousIndex === 0) {
        logger.info(
            'YouTube check successful. No new uploads.'
        );

        return {
            status: 'unchanged',
            count: 0,
        };
    }

    if (previousIndex === -1) {
        // The saved video is no longer among the latest
        // results. Avoid announcing an uncertain backlog.
        logger.warn(
            'Saved YouTube video was not found in the latest playlist results. Checking the newest video only.'
        );

        const newestVideo = videos[0];
        const sent = await sendNotification(
            client,
            newestVideo
        );

        if (!sent) {
            throw new Error(
                'Could not send the newest video notification to any server.'
            );
        }

        await client.db.set(
            YOUTUBE_LAST_VIDEO_KEY,
            newestVideo.videoId
        );

        return {
            status: 'announced',
            count: 1,
        };
    }

    const newVideos = videos
        .slice(0, previousIndex)
        .reverse();

    let announced = 0;

    for (const video of newVideos) {
        const sent = await sendNotification(client, video);

        if (!sent) {
            // Stop here so this video and any remaining newer
            // videos can be retried during the next check.
            throw new Error(
                `Failed to announce "${video.title}". The remaining uploads will be retried.`
            );
        }

        await client.db.set(
            YOUTUBE_LAST_VIDEO_KEY,
            video.videoId
        );

        announced++;
    }

    logger.info(
        `YouTube check completed. Announced ${announced} new video(s).`
    );

    return {
        status: 'announced',
        count: announced,
    };
}

// Calculate delay to the next 15-minute boundary in IST.
function getDelayUntilNextCheck() {
    const now = getISTNow();

    const hour = now.getUTCHours();

    if (hour < CHECK_START_HOUR) {
        return Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate(),
            CHECK_START_HOUR,
            0,
            0
        ) - now.getTime();
    }

    if (hour >= CHECK_END_HOUR) {
        return Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 1,
            CHECK_START_HOUR,
            0,
            0
        ) - now.getTime();
    }

    const elapsedMinutes =
        now.getUTCMinutes() +
        now.getUTCSeconds() / 60 +
        now.getUTCMilliseconds() / 60000;

    return (
        (15 - (elapsedMinutes % 15)) *
        60 * 1000
    );
}

async function runScheduledCheck(client) {
    try {
        logger.info('Running scheduled YouTube API check.');

        await checkYouTubeUploads(client);
    } catch (error) {
        logger.error(
            'Scheduled YouTube check failed:',
            error
        );
    }
}

export function startYouTubeNotifications(client) {
    let stopped = false;
    let scheduleTimer;

    const scheduleNextCheck = () => {
        if (stopped) return;

        const delay = getDelayUntilNextCheck();

        logger.info(
            `Next YouTube check in ${Math.ceil(delay / 60000)} minute(s). Daily window: 6 PM–10 PM IST.`
        );

        scheduleTimer = setTimeout(async () => {
            if (stopped) return;

            const hour = getISTNow().getUTCHours();

            if (
                hour >= CHECK_START_HOUR &&
                hour < CHECK_END_HOUR
            ) {
                await runScheduledCheck(client);
            }

            // Always schedule another check after success or error.
            if (!stopped) {
                scheduleNextCheck();
            }
        }, delay);
    };

    scheduleNextCheck();

    logger.info(
        'YouTube Data API notifications started. Checks run every 15 minutes from 6 PM to 10 PM IST.'
    );

    return () => {
        stopped = true;
        clearTimeout(scheduleTimer);
    };
}
