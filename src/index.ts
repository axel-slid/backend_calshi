import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRouter from "./routes/auth";
import { marketsRouter } from "./routes/markets";
import { meRouter } from "./routes/me";
import { statsRouter } from "./routes/stats";
import { tradesRouter } from "./routes/trades";
import { leaderboardRouter } from "./routes/leaderboard";

const app = express();
app.set("trust proxy", 1);

// ---- CORS ----
const allowedOrigins = [
  "https://www.calshi.app",
  "https://calshi.app",
  "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// NOTE: Express 5 crashes on app.options("*", ...). Don't add it.

// ---- Parsers ----
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Canary/debug ----
app.get("/__ping", (_req, res) => res.status(200).send("pong-v1"));
app.post("/debug/body", (req, res) =>
  res.status(200).json({ contentType: req.headers["content-type"], body: req.body })
);

// ---- Health ----
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// ---- Routes ----
app.use("/auth", authRouter);
app.use("/markets", marketsRouter);
app.use("/me", meRouter);
app.use("/stats", statsRouter);
app.use("/trades", tradesRouter);
app.use("/leaderboard", leaderboardRouter);

// ---- Error handler ----
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`Server listening on ${port}`));