import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Some codebases also use SUPABASE_ANON_KEY; keep optional.
const ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL env var");
if (!SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY env var");

// "Public" client (if you have an anon key). If not, we fall back to service role so it still works.
export const supabase = createClient(SUPABASE_URL, ANON_KEY || SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Admin/service-role client (what your db/middleware/routes are importing)
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});