import { Router } from "express";
import { z } from "zod";
import { OAuth2Client } from "google-auth-library";
import { supabaseAdmin } from "../supabase";
import { signSession } from "../session";
import { upsertUserAndMaybeGrantSignupBonus } from "../db/users";

const authRouter = Router();

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
});

authRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });
  if (!googleClientId) return res.status(500).json({ error: "Server misconfigured" });

  const { idToken, username } = parsed.data;

  try {
    const ticket = await oauthClient.verifyIdToken({ idToken, audience: googleClientId });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ error: "Invalid token" });

    const email = (payload.email ?? "").toLowerCase();
    const emailVerified = payload.email_verified === true;

    if (!emailVerified) return res.status(403).json({ error: "Email not verified by Google" });
    if (!email.endsWith("@berkeley.edu")) return res.status(403).json({ error: "Must use @berkeley.edu" });

    // Username uniqueness check
    const { data: existingName, error: nameErr } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (nameErr) return res.status(500).json({ error: nameErr.message });
    if (existingName) return res.status(409).json({ error: "Username already taken" });

    // ✅ Upsert user and grant signup bonus ONCE (credits += 1000)
    const userWithCredits = await upsertUserAndMaybeGrantSignupBonus(email);

    // ✅ Ensure username set
    const { data: updated, error: updErr } = await supabaseAdmin
      .from("users")
      .update({ username })
      .eq("id", userWithCredits.id)
      .select("id,email,username,credits,created_at")
      .single();

    if (updErr) return res.status(500).json({ error: updErr.message });

    // ✅ JWT session token for frontend (works even if cookies blocked)
    const sessionToken = signSession({ userId: updated.id, email: updated.email });

    // Optional cookie for setups that want it (middleware supports it)
    res.cookie("session", sessionToken, {
      httpOnly: true,
      sameSite: "none",
      secure: true,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user: updated, sessionToken });
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
});

authRouter.post("/logout", async (_req, res) => {
  res.clearCookie("session", { path: "/", sameSite: "none", secure: true });
  res.json({ ok: true });
});

export default authRouter;