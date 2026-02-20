import express from "express";
import cors from "cors";
import session from "express-session";

import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { tradesRouter } from "./routes/trades";
import { marketsRouter } from "./routes/markets";
import { statsRouter } from "./routes/stats";

const app = express();


const ALLOWED_ORIGINS = new Set<string>([
  "http://localhost:5173",
  "http://localhost:3000",

  // Your Vercel + custom domains (from your screenshot)
  "https://frontendcalshi.vercel.app",
  "https://frontendcalshi-nki17b6rr-dils-6980s-projects.vercel.app",
  "https://www.calshi.app",
  "https://calshi.app"
]);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow non-browser clients or same-origin requests with no Origin header
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);

      return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);


app.use("/auth", authRouter);

import cookieParser from "cookie-parser";

app.use(cookieParser());

/**
 * Railway runs behind a proxy. Required for secure cookies.
 */
app.set("trust proxy", 1);

/**
 * Body parsing
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/**
 * CORS
 * Must list the exact origins that will call the API.
 * Do NOT use "*" with credentials.
 */


/**
 * Sessions
 * Cross-site cookie must be SameSite=None + Secure for Vercel -> Railway.
 */
if (!process.env.SESSION_SECRET) {
  console.warn("WARNING: SESSION_SECRET is not set. Sessions will not be secure.");
}

app.use(
  session({
    name: "calshi.sid",
    secret: process.env.SESSION_SECRET || "dev-insecure-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true, // Railway is HTTPS
      sameSite: "none",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

/**
 * Health check
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

/**
 * Start server
 */
const port = process.env.PORT || 8080;

app.post("/auth/complete", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.listen(port, () => {
  console.log(`API listening on :${port}`);
});