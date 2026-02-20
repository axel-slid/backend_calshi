import { Request, Response, NextFunction } from "express";
import { verifySession } from "../session";

/**
 * requireAuth supports:
 *  1) express-session cookie (preferred for browser)
 *  2) Bearer token (optional, for API testing)
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1) ✅ express-session auth (what your app is actually using)
  const sess: any = (req as any).session;
  if (sess?.userId) {
    (req as any).user = { userId: sess.userId, email: sess.email };
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
    (req as any).user = claims;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}