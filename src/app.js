import express from "express";
import cors from "cors";
import morgan from "morgan";
import { clerkMiddleware } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import secretRoutes from "./routes/secretRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

const allowedOrigins = (process.env.CLIENT_URLS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

// Attaches req.auth() when a Clerk session is present; does not block routes.
app.use(clerkMiddleware());

// Basic protection against brute forcing password-protected share links
const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api/share", shareLimiter);

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "SecretShare API is running" });
});

app.use("/api", secretRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;