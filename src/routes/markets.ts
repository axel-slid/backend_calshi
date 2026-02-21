import { Router } from "express";
import { supabase } from "../supabase";
import { supabaseAdmin } from "../supabase";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { optionalAuth } from "../middleware/optionalAuth";

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

/**
 * ------------------------------
 * Market Suggestions + Voting
 * ------------------------------
 * Users can post market ideas "anonymously" (we store user_id for anti-abuse,
 * but we never return it from the API).
 */

const SuggestionCreateSchema = z.object({
  title: z.string().trim().min(5).max(140),
  details: z.string().trim().max(2000).optional().default(""),
});

const SuggestionVoteSchema = z.object({
  value: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
});

/**
 * GET /markets/suggestions
 * Public list of suggestions with score + counts.
 * If requester is authed, also returns their vote for each suggestion.
 */
marketsRouter.get("/suggestions", optionalAuth, async (req, res) => {
  const viewerId = (req as any).user?.userId as string | undefined;

  const { data: suggestionsRaw, error: sugErr } = await supabaseAdmin
    .from("market_suggestions")
    .select("id, title, details, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (sugErr) {
    return res.status(500).json({ error: "Database error", details: sugErr.message });
  }

  const suggestions = suggestionsRaw ?? [];
  const ids = suggestions.map((s: any) => s.id).filter(Boolean);

  const scoreById = new Map<string, number>();
  const upById = new Map<string, number>();
  const downById = new Map<string, number>();

  if (ids.length) {
    const { data: votes, error: votesErr } = await supabaseAdmin
      .from("market_suggestion_votes")
      .select("suggestion_id, value")
      .in("suggestion_id", ids);

    if (votesErr) {
      return res.status(500).json({ error: "Database error", details: votesErr.message });
    }

    for (const v of votes ?? []) {
      const sid = String((v as any).suggestion_id ?? "");
      const val = Number((v as any).value ?? 0);
      if (!sid) continue;
      if (val === 1) upById.set(sid, (upById.get(sid) ?? 0) + 1);
      if (val === -1) downById.set(sid, (downById.get(sid) ?? 0) + 1);
      scoreById.set(sid, (scoreById.get(sid) ?? 0) + (val === 1 ? 1 : val === -1 ? -1 : 0));
    }
  }

  const viewerVoteById = new Map<string, number>();
  if (viewerId && ids.length) {
    const { data: viewerVotes, error: vvErr } = await supabaseAdmin
      .from("market_suggestion_votes")
      .select("suggestion_id, value")
      .eq("user_id", viewerId)
      .in("suggestion_id", ids);

    if (vvErr) {
      return res.status(500).json({ error: "Database error", details: vvErr.message });
    }
    for (const v of viewerVotes ?? []) {
      const sid = String((v as any).suggestion_id ?? "");
      const val = Number((v as any).value ?? 0);
      if (!sid) continue;
      viewerVoteById.set(sid, val);
    }
  }

  return res.status(200).json({
    suggestions: suggestions.map((s: any) => {
      const id = String(s.id);
      return {
        id,
        title: s.title,
        details: s.details ?? "",
        created_at: s.created_at,
        score: scoreById.get(id) ?? 0,
        upvotes: upById.get(id) ?? 0,
        downvotes: downById.get(id) ?? 0,
        viewer_vote: viewerId ? viewerVoteById.get(id) ?? 0 : 0,
      };
    }),
  });
});

/**
 * POST /markets/suggestions
 * Create a new suggestion.
 */
marketsRouter.post("/suggestions", requireAuth, async (req, res) => {
  const parsed = SuggestionCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { title, details } = parsed.data;
  const userId = (req as any).user?.userId as string;

  const { data, error } = await supabaseAdmin
    .from("market_suggestions")
    .insert({ title, details, user_id: userId })
    .select("id, title, details, created_at")
    .single();

  if (error) {
    return res.status(500).json({ error: "Database error", details: error.message });
  }

  return res
    .status(201)
    .json({ suggestion: { ...data, score: 0, upvotes: 0, downvotes: 0, viewer_vote: 0 } });
});

/**
 * POST /markets/suggestions/:id/vote
 * Body: { value: 1 | -1 | 0 }  (0 removes vote)
 */
marketsRouter.post("/suggestions/:id/vote", requireAuth, async (req, res) => {
  const suggestionId = String(req.params.id ?? "").trim();
  if (!suggestionId) return res.status(400).json({ error: "Missing suggestion id" });

  const parsed = SuggestionVoteSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const userId = (req as any).user?.userId as string;
  const value = parsed.data.value;

  // Ensure suggestion exists
  const { data: exists, error: exErr } = await supabaseAdmin
    .from("market_suggestions")
    .select("id")
    .eq("id", suggestionId)
    .maybeSingle();

  if (exErr) return res.status(500).json({ error: "Database error", details: exErr.message });
  if (!exists) return res.status(404).json({ error: "Suggestion not found" });

  if (value === 0) {
    const { error: delErr } = await supabaseAdmin
      .from("market_suggestion_votes")
      .delete()
      .eq("suggestion_id", suggestionId)
      .eq("user_id", userId);
    if (delErr) return res.status(500).json({ error: "Database error", details: delErr.message });
  } else {
    const { error: upErr } = await supabaseAdmin.from("market_suggestion_votes").upsert(
      { suggestion_id: suggestionId, user_id: userId, value },
      { onConflict: "suggestion_id,user_id" }
    );
    if (upErr) return res.status(500).json({ error: "Database error", details: upErr.message });
  }

  // Return updated rollup
  const { data: votes, error: vErr } = await supabaseAdmin
    .from("market_suggestion_votes")
    .select("value")
    .eq("suggestion_id", suggestionId);

  if (vErr) return res.status(500).json({ error: "Database error", details: vErr.message });

  let score = 0;
  let upvotes = 0;
  let downvotes = 0;
  for (const v of votes ?? []) {
    const val = Number((v as any).value ?? 0);
    if (val === 1) {
      score += 1;
      upvotes += 1;
    } else if (val === -1) {
      score -= 1;
      downvotes += 1;
    }
  }

  return res.status(200).json({ suggestionId, score, upvotes, downvotes, viewer_vote: value });
});