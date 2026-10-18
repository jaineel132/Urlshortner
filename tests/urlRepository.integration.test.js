import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Set test database environment variables BEFORE importing app modules.
// dotenv.config() in connection.js does not override already-set env vars.
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5434";
process.env.DB_NAME = "url_shortener_test";
process.env.DB_USER = "postgres";
process.env.DB_PASSWORD = "test-only-password";

// Dynamically import after env vars are set
const pool = (await import("../src/db/connection.js")).default;
const { saveURL, getURLByShortCode } = await import("../src/repositories/urlRepository.js");

// Verify we're connected to the test database, not the main one.
// Note: inet_server_port() returns the internal container port (5432), not the host port (5434).
before(async () => {
    const result = await pool.query("SELECT current_database()");
    const db = result.rows[0];
    assert.equal(db.current_database, "url_shortener_test");
    // Also verify pool config matches test values
    assert.equal(Number(pool.options.port), 5434);
    assert.equal(pool.options.database, "url_shortener_test");
    assert.equal(pool.options.host, "127.0.0.1");
    assert.equal(pool.options.user, "postgres");
});

after(async () => {
    await pool.end();
});

test("saveURL saves a URL and getURLByShortCode retrieves it", async () => {
    const unique = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const email = `test-${unique}@example.com`;
    const shortCode = `test${unique}`;
    const originalUrl = `https://example.com/${unique}`;
    let userId;

    try {
        // Create unique test user (urls table requires user_id)
        const userResult = await pool.query(
            "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id",
            [email, "test-hash"]
        );
        userId = userResult.rows[0].id;

        // Save URL
        const saved = await saveURL(originalUrl, shortCode, null, userId);
        assert.equal(saved.original_url, originalUrl);
        assert.equal(saved.short_code, shortCode);
        assert.equal(saved.user_id, userId);

        // Retrieve URL
        const fetched = await getURLByShortCode(shortCode);
        assert.ok(fetched, "Expected URL to be found");
        assert.equal(fetched.original_url, originalUrl);
        assert.equal(fetched.short_code, shortCode);
        assert.equal(fetched.user_id, userId);
    } finally {
        // Clean up test URL and test user even if assertions fail
        if (userId) {
            await pool.query("DELETE FROM urls WHERE user_id = $1", [userId]).catch(() => {});
            await pool.query("DELETE FROM users WHERE id = $1", [userId]).catch(() => {});
        }
    }
});

test("getURLByShortCode returns undefined for nonexistent short code", async () => {
    const nonexistentCode = `nonexistent-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const result = await getURLByShortCode(nonexistentCode);
    assert.equal(result, undefined);
});