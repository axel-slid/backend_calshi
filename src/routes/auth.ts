import { Router } from "express";
import { z } from "zod";
import { verifyGoogleIdToken } from "../google";
import { upsertUserAndMaybeGrantSignupBonus } from "../db/users";
import { signSession } from "../session";
const isProd = process.env.NODE_ENV === "production";
export const authRouter = Router();


/**
 * DEV LOGIN — LOCAL ONLY
 * POST /auth/dev
 * body: { email }
 */
authRouter.post("/dev", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Not found" });
  }

  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Bad request" });
  }

  const { email } = parsed.data;

  try {
    const user = await upsertUserAndMaybeGrantSignupBonus(email);
    const session = signSession({ userId: user.id, email: user.email });

res.cookie("session", session, {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

    return res.json({ user });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Dev auth failed" });
  }
});

/**
 * GOOGLE LOGIN
 * POST /auth/google
 * body: { idToken }
 */
authRouter.post("/google", async (req, res) => {
  const parsed = z.object({ idToken: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Bad request" });
  }

  try {
    const { email } = await verifyGoogleIdToken(parsed.data.idToken);
    const user = await upsertUserAndMaybeGrantSignupBonus(email);
    const session = signSession({ userId: user.id, email: user.email });

res.cookie("session", session, {
  httpOnly: true,
  sameSite: isProd ? "none" : "lax",
  secure: isProd,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

    return res.json({ user });
  } catch (e: any) {
    return res.status(401).json({ error: e?.message ?? "Auth failed" });
  }
});



/**
 * LOGOUT
 * POST /auth/logout
 */
authRouter.post("/logout", (_req, res) => {
  res.clearCookie("session");
  return res.json({ ok: true });
});