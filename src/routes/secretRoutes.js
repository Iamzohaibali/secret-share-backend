import express from "express";
import { requireAuthUser } from "../middleware/auth.js";
import {
  createSecret,
  getMySecrets,
  getSecretById,
  updateSecret,
  deleteSecret,
  getShareMeta,
  revealSecret,
} from "../controllers/secretController.js";

const router = express.Router();

// --- Private (requires signed-in Clerk user) ---
router.post("/secrets", requireAuthUser, createSecret);
router.get("/secrets", requireAuthUser, getMySecrets);
router.get("/secrets/:id", requireAuthUser, getSecretById);
router.patch("/secrets/:id", requireAuthUser, updateSecret);
router.delete("/secrets/:id", requireAuthUser, deleteSecret);

// --- Public (share links, no auth needed) ---
router.get("/share/:shareId", getShareMeta);
router.post("/share/:shareId/reveal", revealSecret);

export default router;