import { Router } from "express";
import { supabaseAdmin } from "../supabase";

export const statsRouter = Router();

/**
 * GET /stats
 * Uses trades table:
 * - activeTokensStaked: sum(amount)
 * - dailyForecasters: distinct user_id who traded in last 24h
 */
statsRouter.get("/", async (_req, res) => {
  const { data: trades, error } = await supabaseAdmin
    .from("trades")
    .select("user_id,amount,created_at");

  if (error) return res.status(500).json({ error: error.message });

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  let activeTokensStaked = 0;
  const dailyUsers = new Set<string>();

  for (const t of trades ?? []) {
    activeTokensStaked += Number((t as any).amount ?? 0);

    const ts = new Date(String((t as any).created_at)).getTime();
    if (!Number.isNaN(ts) && now - ts <= DAY_MS) {
      dailyUsers.add(String((t as any).user_id));
    }
  }

  return res.json({
    activeTokensStaked,
    dailyForecasters: dailyUsers.size,
  });
});