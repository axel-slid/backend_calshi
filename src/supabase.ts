import { createClient } from "@supabase/supabase-js";

// Environment variables (set in Railway → Variables)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Hard fail early if misconfigured
if (!SUPABASE_URL) {
  throw new Error("Missing SUPABASE_URL environment variable");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY environment variable");
}

/**
 * Supabase client for normal server operations (reads + limited writes).
 * Uses anon key if provided, otherwise falls back to service role.
 */
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY ?? SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

/**
 * Supabase admin client (FULL DB ACCESS).
 * Use only when you explicitly need elevated permissions.
 */
export const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);