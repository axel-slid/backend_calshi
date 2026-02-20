import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";

import authRouter from "./routes/auth";
import marketsRouter from "./routes/markets"; // adjust if your paths differ
import meRouter from "./routes/me";           // adjust if your paths differ

const app = express();

// --- trust proxy (Railway) ---
app.set("trust proxy", 1);

// --- CORS ---
const allowedOrigins = (process.env.FRONTEND_ORIGINS ?? process.env.FRONTEND_ORIGIN ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Fallbacks if env isn't set correctly
if (allowedOrigins.length === 0) {
  allowedOrigins.push("https://www.calshi.app", "https://calshi.app", "http://localhost:5173");
}

app.use(
  cors({
    origin: (origin, callback) => {
      // allow non-browser tools (curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Make OPTIONS preflight always return CORS headers
app.options("*", cors());

// --- parsers (must be BEFORE routers) ---
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.post("/debug/body", (req, res) => {
  res.json({
    contentType: req.headers["content-type"],
    bodyType: typeof req.body,
    body: req.body,
  });
});


// --- session ---
app.use(
  session({
    name: "calshi.sid",
    secret: process.env.SESSION_SECRET || "dev-insecure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "none", // needed for cross-site cookies (frontend domain != backend domain)
      secure: true,     // must be true for sameSite:none on https
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  })
);

// --- routes ---
app.get("/health", (_req, res) => res.status(200).json({ ok: true }));

app.use("/auth", authRouter);
app.use("/markets", marketsRouter);
app.use("/me", meRouter);

// --- error handler for CORS and others ---
app.use((err: any, _req: any, res: any, _next: any) => {
  // Most common: thrown by CORS origin check
  if (typeof err?.message === "string" && err.message.startsWith("CORS blocked origin:")) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: "Internal server error" });
});


const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Server listening on ${port}`);
});