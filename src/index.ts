import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";

import authRouter from "./routes/auth";
import { marketsRouter } from "./routes/markets";
import { meRouter } from "./routes/me";

// If these exist in your repo, keep them; otherwise remove these two lines
import { tradesRouter } from "./routes/trades";
import { statsRouter } from "./routes/stats";

const app = express();
app.set("trust proxy", 1);

// ---- CORS first ----
const allowedOrigins = ["https://www.calshi.app", "https://calshi.app", "http://localhost:5173"];

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


// ---- Parsers before routers ----
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---- Canary/debug endpoints (for deployment + body parsing) ----
app.get("/__ping", (_req, res) => res.status(200).send("pong-v1"));
app.post("/debug/body", (req, res) => {
  res.status(200).json({
    contentType: req.headers["content-type"],
    body: req.body,
  });
});

// ---- Session ----
app.use(
  session({
    name: "calshi.sid",
    secret: process.env.SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

// ---- Health ----
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

// ---- Routers ----
app.use("/auth", authRouter);
app.use("/markets", marketsRouter);
app.use("/me", meRouter);

// If these routers exist in your repo, keep; if not, delete them
app.use("/trades", tradesRouter);
app.use("/stats", statsRouter);

// ---- Error handler ----
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  res.status(500).json({ error: err?.message || "Internal server error" });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});