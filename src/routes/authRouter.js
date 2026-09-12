import express from "express";
import { registerController, loginController } from "../controllers/authController.js";
import { validateCredentials, validateRegister } from "../middleware/validateCredentials.js";

const router = express.Router();

router.post("/register", validateRegister, registerController);
router.post("/login", validateCredentials, loginController);

export default router;