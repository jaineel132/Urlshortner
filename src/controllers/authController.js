import { registerUser } from "../services/userService.js";

async function registerController(req, res, next) {
    const { email, password } = req.body;
    try {
        const user = await registerUser(email, password);
        res.status(201).json({ id: user.id, email: user.email, created_at: user.created_at });
    } catch (error) {
        next(error);
    }
}

export { registerController };
