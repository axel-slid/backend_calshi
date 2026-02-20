import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { supabaseAdmin } from "../supabase";

export const meRouter = Router();

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