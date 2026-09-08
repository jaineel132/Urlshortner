import jwt from 'jsonwebtoken';

function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Authentication required" });
    }

    const parts = authHeader.split(" ");

    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
        return res.status(401).json({ error: "Invalid authorization header" });
    }

    try {
        const payload = jwt.verify(parts[1], process.env.JWT_SECRET);
        req.user = { id: payload.sub };
        next();
    } catch {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

export { authMiddleware };