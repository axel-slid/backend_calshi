import { Router } from "express";
import { supabase } from "../supabase";
import { supabaseAdmin } from "../supabase";

export const marketsRouter = Router();

/**
 * GET /markets
 * Returns latest markets + computed "volume" (tokens traded) per market.
 *
 * Volume is computed as SUM(trades.amount) grouped by market_id.
 */
marketsRouter.get("/", async (_req, res) => {
  // 1) Fetch markets (public read)
  const { data: marketsRaw, error: marketsErr } = await supabase
    .from("markets")
    .select("id, question, status, created_at, yes_price, no_price, rules, ends_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (marketsErr) {
    return res.status(500).json({
      error: "Database error",
      details: marketsErr.message,
    });
  }

  const marketsList = marketsRaw ?? [];
  const marketIds = marketsList.map((m: any) => m.id).filter(Boolean);

  // 2) Fetch trades for those markets (admin read to bypass any RLS)
  const volumeByMarket = new Map<string, number>();

  if (marketIds.length > 0) {
    const { data: trades, error: tradesErr } = await supabaseAdmin
      .from("trades")
      .select("market_id, amount")
      .in("market_id", marketIds);

    if (tradesErr) {
      return res.status(500).json({
        error: "Database error",
        details: tradesErr.message,
      });
    }

    for (const t of trades ?? []) {
      const mid = String((t as any).market_id ?? "");
      const amt = Number((t as any).amount ?? 0);
      if (!mid) continue;
      volumeByMarket.set(mid, (volumeByMarket.get(mid) ?? 0) + (Number.isFinite(amt) ? amt : 0));
    }
  }

  // 3) Normalize output + attach computed volume
  const markets = marketsList.map((m: any) => {
    const yesRaw = m.yes_price;
    const noRaw = m.no_price;

    const yesPrice =
      typeof yesRaw === "number" ? yesRaw : yesRaw != null ? Number(yesRaw) : 0.5;

    const noPrice =
      typeof noRaw === "number" ? noRaw : noRaw != null ? Number(noRaw) : 1 - yesPrice;

    const volume = volumeByMarket.get(String(m.id)) ?? 0;

    return {
      id: m.id,
      question: m.question,
      status: m.status,
      created_at: m.created_at,

      // ✅ now real
      volume: Math.floor(volume),

      yes_price: yesPrice,
      no_price: noPrice,
      rules: m.rules ?? "",
      ends_at: m.ends_at ?? null,
    };
  });

  return res.status(200).json({ markets });
});