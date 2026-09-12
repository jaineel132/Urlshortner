function validateCredentials(req, res, next) {
    const { email, password } = req.body;

    if (email === undefined || typeof email !== "string") {
        return res.status(400).json({
            error: "Email is required and must be a string"
        });
    }

    if (email.trim() === "") {
        return res.status(400).json({
            error: "Email must not be empty"
        });
    }

    if (password === undefined || typeof password !== "string") {
        return res.status(400).json({
            error: "Password is required and must be a string"
        });
    }

    if (password.trim() === "") {
        return res.status(400).json({
            error: "Password must not be empty"
        });
    }

    next();
}

function validateRegister(req, res, next) {
    validateCredentials(req, res, () => {
        const { password } = req.body;

        if (password.length < 8) {
            return res.status(400).json({
                error: "Password must be at least 8 characters long"
            });
        }

        next();
    });
}

export { validateCredentials, validateRegister };