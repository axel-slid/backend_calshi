import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { tradesRouter } from "./routes/trades";

import { supabaseAdmin } from "./supabase";



dotenv.config();

const app = express();

console.log("FRONTEND_ORIGIN =", process.env.FRONTEND_ORIGIN);

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/trades", tradesRouter);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/debug/supabase", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id,email,credits")
    .limit(1);

  res.json({ ok: !error, error: error?.message ?? null, data });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});