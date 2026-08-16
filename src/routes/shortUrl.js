import express from "express";
import { healthCheck,shortenURLController ,getOriginalURLController} from "../controllers/shortController.js";

const router = express.Router();

router.post("/shorten", shortenURLController);
router.get("/health", healthCheck);
router.get("/:shortcode", getOriginalURLController);


export default router;