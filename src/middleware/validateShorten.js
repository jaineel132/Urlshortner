function validateShortenURL(req, res, next) {
    const { original_url, custom_alias, expires_at } = req.body;

    // 1. Validate original_url
    if (typeof original_url !== "string") {
        return res.status(400).json({
            error: "Original URL must be a string"
        });
    }

    if (original_url.trim() === "") {
        return res.status(400).json({
            error: "Original URL is required"
        });
    }

    try {
        const url = new URL(original_url);

        if (url.protocol !== "http:" && url.protocol !== "https:") {
            return res.status(400).json({
                error: "Original URL must use HTTP or HTTPS"
            });
        }
    } catch {
        return res.status(400).json({
            error: "Invalid URL format"
        });
    }

    // 2. Validate custom_alias if provided
    if (custom_alias !== undefined) {
        if (typeof custom_alias !== "string") {
            return res.status(400).json({
                error: "Custom alias must be a string"
            });
        }

        if (custom_alias.length < 4 || custom_alias.length > 30) {
            return res.status(400).json({
                error: "Custom alias must be between 4 and 30 characters"
            });
        }

        const aliasPattern = /^[A-Za-z0-9_-]+$/;

        if (!aliasPattern.test(custom_alias)) {
            return res.status(400).json({
                error: "Custom alias can only contain letters, numbers, hyphens, and underscores"
            });
        }
    }

    // 3. Validate expires_at if provided
    if (expires_at !== undefined) {
        if (typeof expires_at !== "string" || expires_at.trim() === "") {
            return res.status(400).json({
                error: "expires_at must be a valid date"
            });
        }

        const expiryDate = new Date(expires_at);

        if (Number.isNaN(expiryDate.getTime())) {
            return res.status(400).json({
                error: "expires_at must be a valid date"
            });
        }

        if (expiryDate <= new Date()) {
            return res.status(400).json({
                error: "expires_at must be in the future"
            });
        }
    }

    next();
}

export { validateShortenURL };