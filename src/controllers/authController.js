import { registerUser, loginUser } from "../services/userService.js";

async function registerController(req, res) {
    const { email, password } = req.body;
    const user = await registerUser(email, password);
    res.status(201).json({ id: user.id, email: user.email, created_at: user.created_at });
}

async function loginController(req, res) {
    const { email, password } = req.body;
    const tokens = await loginUser(email, password);
    res.status(200).json(tokens);
}

export { registerController, loginController };
