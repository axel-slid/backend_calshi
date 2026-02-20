import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Optional: if you have an anon key, set SUPABASE_ANON_KEY.
// If not set, we safely fall back to service role for the non-admin client.
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL env var");
if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");

// Public-ish client (anon if available, otherwise service role)
export const supabase = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Admin client (service role) — your code imports this as supabaseAdmin
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});