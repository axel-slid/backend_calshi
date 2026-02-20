import { Request, Response, NextFunction } from "express";
import { verifySession } from "../session";
import { supabaseAdmin } from "../supabase";

function getCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;

  // simple cookie parse
  const parts = raw.split(";").map(p => p.trim());
  for (const p of parts) {
    if (p.startsWith(name + "=")) {
      return decodeURIComponent(p.slice(name.length + 1));
    }
  }
  return null;
}

/**
 * requireAuth supports:
 *  1) express-session (req.session.userId)
 *  2) Cookie JWT: session=<token>   ✅ THIS MATCHES YOUR SCREENSHOT
 *  3) Bearer token
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1) express-session
  const sess: any = (req as any).session;
  if (sess?.userId) {
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

  // 2) JWT in cookie named "session"  ✅ (what you’re actually sending)
  const cookieJwt = getCookie(req, "session");
  if (cookieJwt) {
    try {
      const claims = verifySession(cookieJwt);

      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id,email")
        .eq("id", claims.userId)
        .maybeSingle();

      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(401).json({ error: "Not authenticated" });

      (req as any).user = { userId: data.id, email: data.email };
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid session" });
    }
  }

  // 3) Bearer token
  const bearer =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : null;

  if (!bearer) return res.status(401).json({ error: "Not authenticated" });

  try {
    const claims = verifySession(bearer);

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id,email")
      .eq("id", claims.userId)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(401).json({ error: "Not authenticated" });

    (req as any).user = { userId: data.id, email: data.email };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}