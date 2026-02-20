import type { Request, Response, NextFunction } from "express";
import { verifySession } from "../session";
import { supabaseAdmin } from "../supabase";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // ✅ Accept JWT from either:
  //  - Cookie: session=<jwt>   (what your screenshot shows)
  //  - Authorization: Bearer <jwt>  (optional)

  const bearer =
    req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice("Bearer ".length)
      : undefined;

  const cookieJwt = (req as any).cookies?.session as string | undefined;

  const token = bearer || cookieJwt;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  let claims: any;
  try {
    claims = verifySession(token); // must return { userId, email?, ... }
  } catch {
    return res.status(401).json({ error: "Invalid session" });
  }

  const userId = claims?.userId;
  if (!userId) return res.status(401).json({ error: "Invalid session" });

  // ✅ This is the “uuid matches users table” validation you want
  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id,email")
    .eq("id", userId)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  if (!user) return res.status(401).json({ error: "Not authenticated" });

  (req as any).user = { userId: user.id, email: user.email };
  next();
}