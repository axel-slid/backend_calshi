import jwt from "jsonwebtoken";
import { db } from "../db";

export async function requireAuth(req: any, res: any, next: any) {
  let token: string | undefined;

  // 1️⃣ Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  // 2️⃣ Fallback: check session cookie
  if (!token && req.cookies?.session) {
    token = req.cookies.session;
  }

  if (!token) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const payload: any = jwt.verify(
      token,
      process.env.APP_JWT_SECRET || process.env.SESSION_SECRET!
    );

    const userId = payload.userId;
    if (!userId) throw new Error("Missing userId");

    // 3️⃣ Verify user exists
    const user = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where("id", "=", userId)
      .executeTakeFirst();

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    // 4️⃣ Attach user to request
    req.user = user;
    req.userId = userId;

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid session" });
  }
}