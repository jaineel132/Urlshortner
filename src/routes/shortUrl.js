import express from "express";
import { healthCheck,shortenURLController ,getOriginalURLController,deleteShortURLController} from "../controllers/shortController.js";
import { validateShorten } from "../middleware/validateShorten.js";

const router = express.Router();

router.post("/shorten",validateShorten ,shortenURLController);
router.get("/health", healthCheck);
router.get("/:shortcode", getOriginalURLController);
router.delete("/:shortcode", deleteShortURLController);


export default router;