import jwt from "jsonwebtoken";

export type SessionClaims = { userId: string; email: string };

export function signSession(claims: SessionClaims) {
  return jwt.sign(claims, process.env.APP_JWT_SECRET!, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionClaims {
  return jwt.verify(token, process.env.APP_JWT_SECRET!) as SessionClaims;
}