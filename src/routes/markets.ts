import { Router } from "express";
import { supabase } from "../supabase";

export const marketsRouter = Router();

marketsRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("markets")
    .select("id, question, status, created_at, yes_price, no_price, rules, ends_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return res.status(500).json({
      error: "Database error",
      details: error.message,
    });
  }

  // Always include volume in response so frontend stays happy,
  // even if markets table doesn't store it
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

      // volume is not a column → provide default
      volume: 0,

      yes_price: yesPrice,
      no_price: noPrice,
      rules: m.rules ?? "",
      ends_at: m.ends_at ?? null,
    };
  });

  return res.status(200).json({ markets });
});