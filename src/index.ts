import express from "express";
import cors from "cors";

import { authRouter } from "./routes/auth";
import { meRouter } from "./routes/me";
import { tradesRouter } from "./routes/trades";
import { marketsRouter } from "./routes/markets";
import { statsRouter } from "./routes/stats";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// allow frontend origin; credentials required for cookie sessions
app.use(
  cors({
    origin: true, // or set your Vite URL explicitly
    credentials: true,
  }),
);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/me", meRouter);
app.use("/trades", tradesRouter);
app.use("/markets", marketsRouter);
app.use("/stats", statsRouter);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`API listening on :${port}`);
});