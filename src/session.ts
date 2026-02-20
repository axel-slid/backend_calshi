import jwt from "jsonwebtoken";

export type SessionClaims = { userId: string; email: string };

function getJwtSecret() {
  const secret = process.env.APP_JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing APP_JWT_SECRET (or SESSION_SECRET fallback) for JWT sessions");
  }
  return secret;
}

export function signSession(claims: SessionClaims) {
  return jwt.sign(claims, getJwtSecret(), { expiresIn: "7d" });
}

export function verifySession(token: string): SessionClaims {
  return jwt.verify(token, getJwtSecret()) as SessionClaims;
}