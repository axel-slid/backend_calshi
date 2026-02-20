import { Router } from "express";
import crypto from "crypto";
import { supabaseAdmin } from "../supabase";

export const referralsRouter = Router();

function generateCode() {
  return `CAL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`; // CAL-8CHARS
}

// GET /referrals/code -> returns an invite code for the current user (create if missing)
referralsRouter.get("/code", async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { data: existing, error: selErr } = await supabaseAdmin
    .from("referral_codes")
    .select("code")
    .eq("referrer_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) return res.status(500).json({ error: "Database error", details: selErr.message });
  if (existing?.code) return res.json({ code: existing.code });

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    const { error: insErr } = await supabaseAdmin
      .from("referral_codes")
      .insert({ code, referrer_user_id: userId });

    if (!insErr) return res.json({ code });
  }

  return res.status(500).json({ error: "Could not generate invite code" });
});

// POST /referrals/redeem { code } -> redeem once, referrer earns up to 10 times (enforced by SQL)
referralsRouter.post("/redeem", async (req: any, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const code = (req.body?.code ?? "").toString().trim().toUpperCase();
  if (!code) return res.status(400).json({ error: "Missing code" });

  const { data, error } = await supabaseAdmin.rpc("redeem_referral_code", {
    p_code: code,
    p_redeemer: userId,
  });

  if (error) return res.status(500).json({ error: "Database error", details: error.message });
  if (!data?.ok) return res.status(400).json({ error: data?.error ?? "Could not redeem" });

  return res.json({ ok: true, new_success_count: data?.new_success_count });
});