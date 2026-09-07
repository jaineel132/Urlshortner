import { registerUser, loginUser } from "../services/userService.js";

async function registerController(req, res, next) {
    const { email, password } = req.body;
    try {
        const user = await registerUser(email, password);
        res.status(201).json({ id: user.id, email: user.email, created_at: user.created_at });
    } catch (error) {
        next(error);
    }
}

async function loginController(req, res, next) {
    const { email, password } = req.body;
    try {
        const tokens = await loginUser(email, password);
        res.status(200).json(tokens);
    } catch (error) {
        next(error);
    }
}

export { registerController, loginController };
