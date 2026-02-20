import { Router } from "express";
import { supabase } from "../supabase";

export const marketsRouter = Router();

// GET /markets
marketsRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("markets")
    // Safer than select("*") once you start adding columns
    .select("id, question, status, created_at, volume, yes_price, no_price, rules, ends_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({
      error: "Database error",
      details: error.message,
    });
  }

  // Normalize fields so the client can rely on them
  const markets = (data ?? []).map((m: any) => {
    const yesRaw = m.yes_price;
    const noRaw = m.no_price;

    const yesPrice =
      typeof yesRaw === "number" ? yesRaw : yesRaw != null ? Number(yesRaw) : 0.5;

    const noPrice =
      typeof noRaw === "number" ? noRaw : noRaw != null ? Number(noRaw) : (1 - yesPrice);

    return {
      id: m.id,
      question: m.question,
      status: m.status,
      created_at: m.created_at,
      volume: m.volume ?? 0,

      yes_price: yesPrice,
      no_price: noPrice,

      rules: m.rules ?? "",
      ends_at: m.ends_at ?? null,
    };
  });

  return res.status(200).json({ markets });
});