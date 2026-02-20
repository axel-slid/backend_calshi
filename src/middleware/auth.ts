import { Request, Response, NextFunction } from "express";
import { verifySession } from "../session";
import { supabaseAdmin } from "../supabase";

/**
 * requireAuth supports:
 *  1) express-session cookie (preferred for browser)
 *  2) Bearer token (optional, for API testing)
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1) ✅ express-session auth (what your app is actually using)
  const sess: any = (req as any).session;
  if (sess?.userId) {
    // Validate that the user still exists.
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .eq("id", sess.userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(401).json({ error: "Not authenticated" });

    (req as any).user = { userId: data.id, email: data.email };
    return next();
  }

  // 2) Optional fallback: Bearer token
  const bearer =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : null;

  if (!bearer) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const claims = verifySession(bearer);
    // Validate token claims against users table.
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .eq("id", claims.userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(401).json({ error: "Not authenticated" });

    // Keep behavior consistent with cookie sessions.
    (req as any).user = { userId: data.id, email: data.email };
    // Best-effort: populate server session too (helps if cookies start working later).
    try {
      const s: any = (req as any).session;
      if (s) {
        s.userId = data.id;
        s.email = data.email;
      }
    } catch {}
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}