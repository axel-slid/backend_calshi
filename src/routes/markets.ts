import { Router } from "express";
import { supabaseAdmin } from "../supabase";

export const marketsRouter = Router();

/**
 * GET /markets
 * Returns markets from Supabase + computed volume from trades table.
 *
 * Expected markets table columns (per your screenshot):
 * - id (uuid)
 * - question (text)
 * - status (text)
 * - created_at (timestamptz)
 */
marketsRouter.get("/", async (_req, res) => {
  // Load markets
  const { data: markets, error: mErr } = await supabaseAdmin
    .from("markets")
    .select("id,question,status,created_at")
    .order("created_at", { ascending: false });

  if (mErr) return res.status(500).json({ error: mErr.message });

  // Load trades (market_id, amount) for aggregation
  const { data: trades, error: tErr } = await supabaseAdmin
    .from("trades")
    .select("market_id,amount");

  if (tErr) return res.status(500).json({ error: tErr.message });

  const volumeByMarket = new Map<string, number>();
  for (const t of trades ?? []) {
    const marketId = String((t as any).market_id);
    const amt = Number((t as any).amount ?? 0);
    volumeByMarket.set(marketId, (volumeByMarket.get(marketId) ?? 0) + amt);
  }

  const shaped = (markets ?? []).map((m: any) => ({
    id: m.id,
    question: m.question,
    status: m.status,
    created_at: m.created_at,
    volume: volumeByMarket.get(String(m.id)) ?? 0,
  }));

  return res.json({ markets: shaped });
});