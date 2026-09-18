import express from "express";
import { healthCheck,shortenURLController ,getOriginalURLController,deleteShortURLController,getURLsController} from "../controllers/shortController.js";
import { validateShorten } from "../middleware/validateShorten.js";
import { authMiddleware } from "../middleware/authMiddleware.js";
import { userLimiter, redirectLimiter } from "../config/rateLimits.js";

const router = express.Router();

router.post("/shorten", authMiddleware, userLimiter, validateShorten, shortenURLController);
router.get("/health", healthCheck);
router.get("/urls", authMiddleware, userLimiter, getURLsController);
router.get("/:shortcode", redirectLimiter, getOriginalURLController);
router.delete("/:shortcode", authMiddleware, userLimiter, deleteShortURLController);


export default router;