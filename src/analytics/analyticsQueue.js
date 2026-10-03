import { Queue } from "bullmq";
import { createAnalyticsConnection } from "./connection.js";

const ANALYTICS_QUEUE_NAME = "analytics";
const JOB_NAME = "record-click";
const ENQUEUE_TIMEOUT_MS = 2000;

const analyticsQueue = new Queue(ANALYTICS_QUEUE_NAME, {
    connection: createAnalyticsConnection({ failFast: true })
});

analyticsQueue.on("error", (err) => {
    console.error("Analytics queue error:", err.message);
});

async function addAnalyticsJob({ eventId, shortCode, clickedAt, userAgent, referrer }) {
    const jobPromise = analyticsQueue.add(JOB_NAME, { eventId, shortCode, clickedAt, userAgent, referrer }, {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: false
    });
    jobPromise.catch(() => {});

    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Analytics enqueue timed out")), ENQUEUE_TIMEOUT_MS);
    });

    try {
        await Promise.race([jobPromise, timeoutPromise]);
    } finally {
        clearTimeout(timer);
    }
}

export { addAnalyticsJob, analyticsQueue };
