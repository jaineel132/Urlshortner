import pool from "../db/connection.js";

async function insertAnalyticsEvent({ eventId, shortCode, clickedAt, userAgent, referrer }) {
    const result = await pool.query(
        `INSERT INTO analytics_events (event_id, short_code, clicked_at, user_agent, referrer)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (event_id) DO NOTHING`,
        [eventId, shortCode, clickedAt, userAgent, referrer]
    );
    return result.rowCount;
}

export { insertAnalyticsEvent };
