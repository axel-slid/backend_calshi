import { Request, Response, NextFunction } from "express";
import { verifySession } from "../session";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token =
    (req as any).cookies?.session ||
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : null);

  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const claims = verifySession(token);
    (req as any).user = claims;
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }
}