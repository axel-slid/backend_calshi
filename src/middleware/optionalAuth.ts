import type { Request, Response, NextFunction } from "express";
import { verifySession } from "../session";
import { supabaseAdmin } from "../supabase";

/**
 * Like requireAuth, but never blocks the request.
 * If a valid session is present, attaches req.user = { userId, email }.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const bearer =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : undefined;

  const cookieJwt = (req as any).cookies?.session as string | undefined;
  const token = bearer || cookieJwt;
  if (!token) return next();

  let claims: any;
  try {
    claims = verifySession(token);
  } catch {
    return next();
  }

  const userId = claims?.userId;
  if (!userId) return next();

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();

  if (error || !user) return next();

  (req as any).user = { userId: user.id, email: user.email };
  return next();
}
