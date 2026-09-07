function validateLogin(req, res, next) {
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

export { validateLogin };
