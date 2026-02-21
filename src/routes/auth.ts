import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { supabaseAdmin } from "../supabase";
import { signSession } from "../session";

export const authRouter = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(googleClientId);

const completeSchema = z.object({
  idToken: z.string().min(20),
  username: z
    .string()
    .trim()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, underscore"),
  referralCode: z.string().trim().optional(),
});

const googleSchema = z.object({
  idToken: z.string().min(20),
});

/**
 * Internal helper:
 * - ensures user exists
 * - ensures they have at least 1000 credits on first signup (and fixes old 0-credit users)
 * - sets username if provided
 */


/**
 * Internal helper:
 * - ensures user exists
 * - grants 1000 credits ONLY once (on first creation)
 * - increments login_count every login
 * - sets username if provided
 */
async function ensureUser(email: string, username?: string) {
  const found = await supabaseAdmin
    .from("users")
    .select("id,email,credits,username,created_at,login_count,signup_bonus_granted")
    .eq("email", email)
    .maybeSingle();

  if (found.error) throw found.error;

  // FIRST LOGIN (user doesn't exist yet)
  if (!found.data) {
    const created = await supabaseAdmin
      .from("users")
      .insert({
        email,
        credits: 1000,
        signup_bonus_granted: true,
        login_count: 1,
        ...(username ? { username } : {}),
      })
      .select("id,email,credits,username,created_at,login_count,signup_bonus_granted")
      .single();

    if (created.error) throw created.error;
    return created.data;
  }

  // EXISTING USER: increment login_count, optionally set username
  const currentLoginCount = Number(found.data.login_count ?? 0);
  const updates: any = { login_count: currentLoginCount + 1 };

  if (username && found.data.username !== username) {
    updates.username = username;
  }

  // IMPORTANT: do NOT touch credits here.
  const updated = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", found.data.id)
    .select("id,email,credits,username,created_at,login_count,signup_bonus_granted")
    .single();

  if (updated.error) throw updated.error;
  return updated.data;
}

/**
 * POST /auth/google
 * body: { idToken }
 * Returns user + sessionToken
 */
authRouter.post("/google", async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });
  if (!googleClientId) return res.status(500).json({ error: "Server misconfigured" });

  const { idToken } = parsed.data;

  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const email = (payload.email ?? "").toLowerCase();
    const emailVerified = payload.email_verified === true;

    if (!emailVerified) return res.status(403).json({ error: "Email not verified by Google" });
    if (!email.endsWith("@berkeley.edu")) return res.status(403).json({ error: "Must use @berkeley.edu" });

    const user = await ensureUser(email);
    const sessionToken = signSession({ userId: user.id, email: user.email });

    res.cookie("session", sessionToken, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user, sessionToken });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * POST /auth/complete
 * body: { idToken, username, referralCode? }
 * Returns user + sessionToken (+ referral result if provided)
 */
authRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });
  if (!googleClientId) return res.status(500).json({ error: "Server misconfigured" });

  const { idToken, username, referralCode } = parsed.data;

  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const email = (payload.email ?? "").toLowerCase();
    const emailVerified = payload.email_verified === true;

    if (!emailVerified) return res.status(403).json({ error: "Email not verified by Google" });
    if (!email.endsWith("@berkeley.edu")) return res.status(403).json({ error: "Must use @berkeley.edu" });

    // username uniqueness
    const nameCheck = await supabaseAdmin.from("users").select("id").ilike("username", username).maybeSingle();
    if (nameCheck.error) return res.status(500).json({ error: nameCheck.error.message });
    if (nameCheck.data) return res.status(409).json({ error: "Username already taken" });

    const user = await ensureUser(email, username);

    // Best-effort referral redeem (does not block signup)
    let referral: any = undefined;
    const code = (referralCode ?? "").toString().trim().toUpperCase();
    if (code) {
      const { data, error } = await supabaseAdmin.rpc("redeem_referral_code", {
        p_code: code,
        p_redeemer: user.id,
      });

      if (error) referral = { ok: false, error: error.message };
      else if (!data?.ok) referral = { ok: false, error: data?.error ?? "Could not redeem" };
      else referral = { ok: true, new_success_count: data?.new_success_count };
    }

    const sessionToken = signSession({ userId: user.id, email: user.email });

    res.cookie("session", sessionToken, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user, sessionToken, referral });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * POST /auth/logout
 */
authRouter.post("/logout", async (_req, res) => {
  res.clearCookie("session", { path: "/", sameSite: "none", secure: true });
  return res.json({ ok: true });
});

export default authRouter;