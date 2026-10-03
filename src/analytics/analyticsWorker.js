import { Worker } from "bullmq";
import { insertAnalyticsEvent } from "../repositories/analyticsRepository.js";
import { createAnalyticsConnection } from "./connection.js";

const analyticsWorker = new Worker("analytics", async (job) => {
    const { eventId, shortCode, clickedAt, userAgent, referrer } = job.data;
    await insertAnalyticsEvent({ eventId, shortCode, clickedAt, userAgent, referrer });
}, {
    connection: createAnalyticsConnection()
});

analyticsWorker.on("ready", () => {
    console.log("Analytics worker ready");
});

analyticsWorker.on("failed", (job, err) => {
    console.error(`Analytics job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);
});

analyticsWorker.on("error", (err) => {
    console.error("Analytics worker error:", err.message);
});

export { analyticsWorker };
