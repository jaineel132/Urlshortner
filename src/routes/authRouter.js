import express from "express";
import { registerController, loginController } from "../controllers/authController.js";
import { validateCredentials, validateRegister } from "../middleware/validateCredentials.js";
import { loginLimiter, registerLimiter } from "../config/rateLimits.js";

const router = express.Router();

router.post("/register", registerLimiter, validateRegister, registerController);
router.post("/login", loginLimiter, validateCredentials, loginController);

export default router;