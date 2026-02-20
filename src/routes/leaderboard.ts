import { Router } from "express";
import { supabaseAdmin } from "../supabase";

export const leaderboardRouter = Router();

/**
 * GET /leaderboard
 * Top users by credits.
 */
leaderboardRouter.get("/", async (_req, res) => {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("username,credits")
    .not("username", "is", null)
    .order("credits", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    leaders: (data ?? []).map((u: any) => ({
      name: String(u.username),
      tokens: Number(u.credits ?? 0),
    })),
  });
});