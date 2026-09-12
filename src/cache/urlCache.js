import { redisClient } from "./redisClient.js";

const CACHE_TTL_SECONDS = 60;

function cacheKey(shortcode) {
    return `url:${shortcode}`;
}

function isRedisReady() {
    return redisClient.isReady === true;
}

async function getCachedURL(shortcode) {
    const key = cacheKey(shortcode);

    try {
        if (!isRedisReady()) {
            console.log("Redis not ready - skipping cache read");
            return null;
        }

        const value = await redisClient.get(key);

        if (value === null) {
            console.log(`Cache MISS: ${key}`);
            return null;
        }

        let parsed;
        try {
            parsed = JSON.parse(value);
        } catch (error) {
            console.error(`Cache parse error for key ${key} - treating as miss:`, error.message);
            await redisClient.del(key).catch(() => {});
            return null;
        }

        if (
            parsed === null ||
            typeof parsed !== "object" ||
            typeof parsed.original_url !== "string" ||
            parsed.original_url.length === 0
        ) {
            console.log(`Cache validation failed for key ${key} - treating as miss`);
            await redisClient.del(key).catch(() => {});
            return null;
        }

        console.log(`Cache HIT: ${key}`);
        return {
            original_url: parsed.original_url,
            expires_at: parsed.expires_at === null || parsed.expires_at === undefined
                ? null
                : new Date(parsed.expires_at)
        };
    } catch (error) {
        console.error(`Redis GET failed for key ${key} - falling back to PostgreSQL:`, error.message);
        return null;
    }
}

async function setCachedURL(shortcode, url) {
    const key = cacheKey(shortcode);

    try {
        if (!isRedisReady()) {
            return;
        }

        const serialized = JSON.stringify({
            original_url: url.original_url,
            expires_at: url.expires_at
        });

        await redisClient.set(key, serialized, { EX: CACHE_TTL_SECONDS });
    } catch (error) {
        console.error(`Redis SET failed for key ${key} - ignoring:`, error.message);
    }
}

async function invalidateCachedURL(shortcode) {
    const key = cacheKey(shortcode);

    try {
        if (!isRedisReady()) {
            return;
        }

        await redisClient.del(key);
    } catch (error) {
        console.error(`Redis DEL failed for key ${key} - ignoring:`, error.message);
    }
}

export { getCachedURL, setCachedURL, invalidateCachedURL };