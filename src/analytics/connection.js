import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

function createAnalyticsConnection({ failFast = false } = {}) {
    return new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
        maxRetriesPerRequest: null,
        ...(failFast
            ? { enableOfflineQueue: false, connectTimeout: 5000, commandTimeout: 2000 }
            : {})
    });
}

export { createAnalyticsConnection };
