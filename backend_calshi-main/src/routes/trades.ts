import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../supabase";

export const tradesRouter = Router();

/**
 * POST /trades
 * body: { marketId: uuid, side: "YES"|"NO", amount: int>0 }
 * - checks user credits
 * - inserts into trades
 * - decrements user credits
 */
tradesRouter.post("/", requireAuth, async (req, res) => {
  const schema = z.object({
    marketId: z.string().uuid(),
    side: z.enum(["YES", "NO"]),
    amount: z.number().int().positive(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });

  const userId = (req as any).user.userId as string;
  const { marketId, side, amount } = parsed.data;

  // fetch current credits
  const { data: user, error: userErr } = await supabaseAdmin
    .from("users")
    .select("id,credits")
    .eq("id", userId)
    .single();

  if (userErr) return res.status(500).json({ error: userErr.message });

  const credits = user?.credits ?? 0;
  if (credits < amount) return res.status(400).json({ error: "Insufficient credits" });

  // insert trade
  const { data: trade, error: tradeErr } = await supabaseAdmin
    .from("trades")
    .insert({
      user_id: userId,
      market_id: marketId,
      side,
      amount,
    })
    .select("*")
    .single();

  if (tradeErr) return res.status(500).json({ error: tradeErr.message });

  // update credits
  const { data: updated, error: updErr } = await supabaseAdmin
    .from("users")
    .update({ credits: credits - amount })
    .eq("id", userId)
    .select("credits")
    .single();

  if (updErr) return res.status(500).json({ error: updErr.message });

  return res.json({ trade, credits: updated?.credits ?? credits - amount });
});

/**
 * GET /trades
 * returns authenticated user's trades
 */
tradesRouter.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;

  const { data, error } = await supabaseAdmin
    .from("trades")
    .select("id,market_id,side,amount,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ trades: data ?? [] });
});