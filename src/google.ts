import { OAuth2Client } from "google-auth-library";

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export async function verifyGoogleIdToken(idToken: string) {
  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload) throw new Error("Missing Google token payload");

  const email = payload.email;
  const emailVerified = payload.email_verified;
  const hd = (payload as any).hd as string | undefined;

  if (!email) throw new Error("Google token missing email");
  if (!emailVerified) throw new Error("Email not verified");
  if (!email.toLowerCase().endsWith("@berkeley.edu")) {
    throw new Error("Must use a berkeley.edu email");
  }
  if (hd && hd !== "berkeley.edu") {
    throw new Error("Hosted domain is not berkeley.edu");
  }

  return { email };
}