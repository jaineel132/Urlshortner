import { redisClient } from "../cache/redisClient.js";

const INCR_EXPIRE_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

function rateLimit({ limit, windowSeconds, scope, keyGenerator }) {
    return async function rateLimiter(req, res, next) {
        let current;

        try {
            if (redisClient.isReady === true) {
                const identifier = await keyGenerator(req);
                const windowId = Math.floor(Date.now() / 1000 / windowSeconds);
                const key = `rate:${scope}:${identifier}:${windowId}`;

                current = await redisClient.eval(INCR_EXPIRE_SCRIPT, {
                    keys: [key],
                    arguments: [String(windowSeconds)]
                });
            }
        } catch (error) {
            console.error("Rate limiter Redis error - allowing request (fail-open):", error.message);
            return next();
        }

        if (current === undefined) {
            return next();
        }

        if (current > limit) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            const retryAfterSeconds = windowSeconds - (nowSeconds % windowSeconds);

            res.set("Retry-After", String(retryAfterSeconds));
            return res.status(429).json({
                error: "Too many requests",
                retryAfterSeconds
            });
        }

        next();
    };
}

export { rateLimit };