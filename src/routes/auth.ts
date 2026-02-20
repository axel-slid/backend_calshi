import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { supabaseAdmin } from "../supabase";

export const authRouter = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const oauthClient = new OAuth2Client(googleClientId);

/**
 * POST /auth/complete
 * body: { idToken: string, username: string }
 * - verifies google ID token
 * - enforces @berkeley.edu
 * - upserts user + saves username
 * - sets session cookie (req.session.userId)
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

    // Username uniqueness check (recommended)
    const { data: existingName, error: nameErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username) // case-insensitive-ish
      .maybeSingle();

    // If you prefer strict case-insensitive uniqueness, do it with a unique index on lower(username)
    if (nameErr) return res.status(500).json({ error: nameErr.message });
    if (existingName) return res.status(409).json({ error: "Username already taken" });

    // Find existing user by email
    const { data: existingUser, error: findErr } = await supabaseAdmin
      .from("users")
      .select("id,email,credits,username")
      .eq("email", email)
      .maybeSingle();

    if (findErr) return res.status(500).json({ error: findErr.message });

    let user = existingUser;

    if (!user) {
      // Create new user with initial credits + username
      const { data: created, error: createErr } = await supabaseAdmin
        .from("users")
        .insert({ email, credits: 1000, username })
        .select("id,email,credits,username")
        .single();

      if (createErr) return res.status(500).json({ error: createErr.message });
      user = created;
    } else {
      // Update username on existing user
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("users")
        .update({ username })
        .eq("id", user.id)
        .select("id,email,credits,username")
        .single();

      if (updErr) return res.status(500).json({ error: updErr.message });
      user = updated;
    }

    // ✅ Set session (this is what makes you "authenticated")
    (req as any).session.userId = user.id;

    return res.json({ user });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

/**
 * Optional: logout
 */
authRouter.post("/logout", async (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("calshi.sid");
    res.json({ ok: true });
  });
});