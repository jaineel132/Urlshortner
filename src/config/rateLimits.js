import { rateLimit } from "../middleware/rateLimiter.js";

const loginLimiter = rateLimit({
    limit: 10,
    windowSeconds: 60,
    scope: "login",
    keyGenerator: (req) => req.ip
});

const registerLimiter = rateLimit({
    limit: 5,
    windowSeconds: 3600,
    scope: "register",
    keyGenerator: (req) => req.ip
});

const userLimiter = rateLimit({
    limit: 30,
    windowSeconds: 60,
    scope: "user",
    keyGenerator: (req) => req.user.id
});

const redirectLimiter = rateLimit({
    limit: 100,
    windowSeconds: 60,
    scope: "redirect",
    keyGenerator: (req) => req.ip
});

export { loginLimiter, registerLimiter, userLimiter, redirectLimiter };