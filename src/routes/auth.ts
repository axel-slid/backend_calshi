import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { supabaseAdmin } from "../supabase";

export const authRouter = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(googleClientId);

/**
 * POST /auth/google
 * body: { idToken: string }
 * - verify Google
 * - enforce @berkeley.edu
 * - find/create user
 * - set session cookie (calshi.sid)
 */
authRouter.post("/google", async (req, res) => {
  const schema = z.object({
    idToken: z.string().min(20),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });
  if (!googleClientId) return res.status(500).json({ error: "Server misconfigured" });

  const { idToken } = parsed.data;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const email = (payload.email ?? "").toLowerCase();
    const emailVerified = payload.email_verified === true;

    if (!emailVerified) return res.status(403).json({ error: "Email not verified by Google" });
    if (!email.endsWith("@berkeley.edu")) return res.status(403).json({ error: "Must use @berkeley.edu" });

    // Find existing by email
    const { data: existingUser, error: findErr } = await supabaseAdmin
      .from("users")
      .select("id,email,credits,username,created_at")
      .eq("email", email)
      .maybeSingle();

    if (findErr) return res.status(500).json({ error: findErr.message });

    let user = existingUser;

    if (!user) {
      // Create with initial credits
      const { data: created, error: createErr } = await supabaseAdmin
        .from("users")
        .insert({ email, credits: 1000 })
        .select("id,email,credits,username,created_at")
        .single();

      if (createErr) return res.status(500).json({ error: createErr.message });
      user = created;
    }

    // ✅ This is the authentication step for the rest of your app:
    (req as any).session.userId = user.id;
    (req as any).session.email = user.email;

    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * POST /auth/complete
 * body: { idToken: string, username: string }
 * - verify Google
 * - save username
 * - set session
 */
authRouter.post("/complete", async (req, res) => {
  const schema = z.object({
    idToken: z.string().min(20),
    username: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, underscore"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });
  if (!googleClientId) return res.status(500).json({ error: "Server misconfigured" });

  const { idToken, username } = parsed.data;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const email = (payload.email ?? "").toLowerCase();
    const emailVerified = payload.email_verified === true;

    if (!emailVerified) return res.status(403).json({ error: "Email not verified by Google" });
    if (!email.endsWith("@berkeley.edu")) return res.status(403).json({ error: "Must use @berkeley.edu" });

    // Optional uniqueness check
    const { data: existingName, error: nameErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (nameErr) return res.status(500).json({ error: nameErr.message });
    if (existingName) return res.status(409).json({ error: "Username already taken" });

    // Find user by email
    const { data: existingUser, error: findErr } = await supabaseAdmin
      .from("users")
      .select("id,email,credits,username,created_at")
      .eq("email", email)
      .maybeSingle();

    if (findErr) return res.status(500).json({ error: findErr.message });

    let user = existingUser;

    if (!user) {
      // Create with username + initial credits
      const { data: created, error: createErr } = await supabaseAdmin
        .from("users")
        .insert({ email, credits: 1000, username })
        .select("id,email,credits,username,created_at")
        .single();

      if (createErr) return res.status(500).json({ error: createErr.message });
      user = created;
    } else {
      // Update username
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("users")
        .update({ username })
        .eq("id", user.id)
        .select("id,email,credits,username,created_at")
        .single();

      if (updErr) return res.status(500).json({ error: updErr.message });
      user = updated;
    }

    // ✅ Set session for subsequent /me, /trades, etc.
    (req as any).session.userId = user.id;
    (req as any).session.email = user.email;

    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

authRouter.post("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("calshi.sid");
    res.json({ ok: true });
  });
});