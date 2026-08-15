import express from "express";
import { healthCheck,shortenURLController } from "../controllers/shortController.js";

const router = express.Router();

router.post("/shorten", shortenURLController);

router.get("/health", healthCheck);

export default router;