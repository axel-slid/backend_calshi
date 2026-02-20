import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../supabase";

export const meRouter = Router();

/**
 * GET /me
 * Returns the authenticated user.
 */
meRouter.get("/", requireAuth, async (req, res) => {
  const userId = (req as any).user.userId as string;

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id,email,username,credits,created_at")
    .eq("id", userId)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ user });
});

/**
 * POST /me/username
 * body: { username: string }
 * Updates the user's username in Supabase.
 */
meRouter.post("/username", requireAuth, async (req, res) => {
  const schema = z.object({
    username: z.string().min(3).max(24).regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, underscore"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });

  const userId = (req as any).user.userId as string;
  const { username } = parsed.data;

  // Optional uniqueness check (recommended if you want unique handles)
  const { data: existing, error: findErr } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("username", username)
    .neq("id", userId)
    .maybeSingle();

  if (findErr) return res.status(500).json({ error: findErr.message });
  if (existing) return res.status(409).json({ error: "Username already taken" });

  const { data: updated, error: updErr } = await supabaseAdmin
    .from("users")
    .update({ username })
    .eq("id", userId)
    .select("id,email,username,credits,created_at")
    .single();

  if (updErr) return res.status(500).json({ error: updErr.message });

  return res.json({ user: updated });
});