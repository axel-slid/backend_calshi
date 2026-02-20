import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";

import { supabase } from "../supabase"; // adjust if your file exports differently

const authRouter = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID;
if (!googleClientId) {
  console.warn("WARNING: GOOGLE_CLIENT_ID is not set");
}
const oauthClient = new OAuth2Client(googleClientId);

const googleSchema = z.object({
  idToken: z.string().min(20),
});

const completeSchema = z.object({
  idToken: z.string().min(20),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24, "Username must be <= 24 characters")
    .regex(/^[a-zA-Z0-9_]+$/, "Username may only contain letters, numbers, underscores"),
});

// POST /auth/google
// Verifies token & returns basic info (optional; keep if your frontend uses it)
authRouter.post("/google", async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken: parsed.data.idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) return res.status(401).json({ error: "Invalid token" });

    return res.status(200).json({
      email: payload.email,
      email_verified: payload.email_verified ?? false,
      name: payload.name ?? null,
      picture: payload.picture ?? null,
    });
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
});

// POST /auth/complete
// Creates/links user in DB and issues a session token (and sets session)
authRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });

  const { idToken, username } = parsed.data;

  // Verify Google ID token
  let email: string | null = null;
  let emailVerified = false;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: googleClientId,
    });
    const payload = ticket.getPayload();
    email = payload?.email ?? null;
    emailVerified = !!payload?.email_verified;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (!email) return res.status(401).json({ error: "Invalid token" });
  if (!emailVerified) return res.status(403).json({ error: "Email not verified" });

  // Berkeley restriction
  if (!email.toLowerCase().endsWith("@berkeley.edu")) {
    return res.status(403).json({ error: "Berkeley email required" });
  }

  // Check username availability
  const { data: existingUserByUsername, error: usernameErr } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (usernameErr) return res.status(500).json({ error: "Database error" });
  if (existingUserByUsername) return res.status(409).json({ error: "Username taken" });

  // Upsert user by email
  const { data: existingByEmail, error: emailErr } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (emailErr) return res.status(500).json({ error: "Database error" });

  let userRow: any;

  if (existingByEmail) {
    const { data: updated, error: updErr } = await supabase
      .from("users")
      .update({ username })
      .eq("id", existingByEmail.id)
      .select("*")
      .single();

    if (updErr) return res.status(500).json({ error: "Database error" });
    userRow = updated;
  } else {
    const { data: created, error: insErr } = await supabase
      .from("users")
      .insert({ email, username })
      .select("*")
      .single();

    if (insErr) return res.status(500).json({ error: "Database error" });
    userRow = created;
  }

  // Issue your app session token (simple random token example)
  // If you already have JWT code, plug it in here.
  const sessionToken = `sess_${crypto.randomUUID()}`;

  // Save session token in express-session
  // @ts-ignore
  req.session.sessionToken = sessionToken;
  // @ts-ignore
  req.session.user = { id: userRow.id, email: userRow.email, username: userRow.username };

  return res.status(200).json({
    user: { id: userRow.id, email: userRow.email, username: userRow.username },
    sessionToken,
  });
});

// POST /auth/logout
authRouter.post("/logout", (req, res) => {
  // @ts-ignore
  req.session?.destroy(() => {
    res.clearCookie("calshi.sid", { sameSite: "none", secure: true });
    res.status(200).json({ ok: true });
  });
});

export default authRouter;