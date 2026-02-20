import dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("Missing SUPABASE_URL in server/.env");
if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY in server/.env");

export const supabaseAdmin = createClient(url, key);