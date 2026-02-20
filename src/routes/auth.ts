import { Router } from "express";
import { z } from "zod";
import { verifyGoogleIdToken } from "../google";
import { upsertUserAndMaybeGrantSignupBonus } from "../db/users";
import { signSession } from "../session";

export const authRouter = Router();

authRouter.post("/google", async (req, res) => {
  const bodySchema = z.object({ idToken: z.string().min(10) });
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Bad request" });

  try {
    const { email } = await verifyGoogleIdToken(parsed.data.idToken);

    // Creates user if needed + grants signup bonus once
    const user = await upsertUserAndMaybeGrantSignupBonus(email);

    // Create your own session token
    const session = signSession({ userId: user.id, email: user.email });

    // Set cookie (secure:false for localhost; set true in production HTTPS)
    res.cookie("session", session, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ user });
  } catch (e: any) {
    return res.status(401).json({ error: e?.message ?? "Auth failed" });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("session");
  return res.json({ ok: true });
});