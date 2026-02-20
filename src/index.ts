import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth";
import { meRouter } from "./routes/me";
import { tradesRouter } from "./routes/trades";
import { marketsRouter } from "./routes/markets";
import { statsRouter } from "./routes/stats";
import { leaderboardRouter } from "./routes/leaderboard";

const app = express();
app.set("trust proxy", 1);

/**
 * CORS (must not use "*" with credentials)
 */
const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://localhost:3000",
  "https://frontendcalshi.vercel.app",
  "https://www.calshi.app",
  "https://calshi.app",
]);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// DO NOT do app.options("*", ...) on Express 5 (it can crash with path-to-regexp)

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Debug/canary
 */
app.get("/__ping", (_req, res) => res.status(200).send("pong"));
app.post("/debug/body", (req, res) =>
  res.status(200).json({ contentType: req.headers["content-type"], body: req.body })
);

/**
 * Health
 */
app.get("/health", (_req, res) => res.json({ ok: true }));

/**
 * Routes
 */
app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/trades", tradesRouter);
app.use("/markets", marketsRouter);
app.use("/stats", statsRouter);
app.use("/leaderboard", leaderboardRouter);

/**
 * Error handler
 */
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});