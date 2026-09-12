import { redisClient } from "./redisClient.js";

async function testRedis() {
    try {
        await redisClient.connect();

        console.log("Redis connected");

        await redisClient.set("test", "hello");
        console.log("SET complete");

        const value = await redisClient.get("test");
        console.log("GET:", value);

        await redisClient.set("temporary", "this will expire", {
            EX: 10
        });

        const ttl = await redisClient.ttl("temporary");
        console.log("TTL:", ttl);
    } catch (error) {
        console.error("Redis test failed:", error);
    } finally {
        await redisClient.quit();
    }
}

testRedis();