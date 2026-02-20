import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { supabase } from "../supabase";

export const authRouter = Router();

const googleClientId = process.env.GOOGLE_CLIENT_ID || "";
const oauthClient = new OAuth2Client(googleClientId);

const completeSchema = z.object({
  idToken: z.string().min(20),
  username: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/),
});

// POST /auth/complete
authRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Bad request" });
  }

  const { idToken, username } = parsed.data;

  // Verify Google ID token
  let email: string | null = null;
  let emailVerified = false;

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: googleClientId || undefined,
    });
    const payload = ticket.getPayload();
    email = payload?.email ?? null;
    emailVerified = !!payload?.email_verified;
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }

  if (!email) return res.status(401).json({ error: "Invalid token" });
  if (!emailVerified) return res.status(403).json({ error: "Email not verified" });

  if (!email.toLowerCase().endsWith("@berkeley.edu")) {
    return res.status(403).json({ error: "Berkeley email required" });
  }

  // Username taken?
  const { data: byUsername, error: usernameErr } = await supabase
    .from("users")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (usernameErr) return res.status(500).json({ error: "Database error", details: usernameErr.message });
  if (byUsername) return res.status(409).json({ error: "Username taken" });

  // Upsert by email
  const { data: byEmail, error: emailErr } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (emailErr) return res.status(500).json({ error: "Database error", details: emailErr.message });

  let userRow: any;

  if (byEmail) {
    const { data: updated, error: updErr } = await supabase
      .from("users")
      .update({ username })
      .eq("id", byEmail.id)
      .select("*")
      .single();

    if (updErr) return res.status(500).json({ error: "Database error", details: updErr.message });
    userRow = updated;
  } else {
    const { data: created, error: insErr } = await supabase
      .from("users")
      .insert({ email, username, tokens: 1000 })
      .select("*")
      .single();

    if (insErr) return res.status(500).json({ error: "Database error", details: insErr.message });
    userRow = created;
  }

  const sessionToken = `sess_${crypto.randomUUID()}`;

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