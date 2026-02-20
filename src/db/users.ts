import { supabaseAdmin } from "../supabase";

const SIGNUP_BONUS = 1000;

export async function upsertUserAndMaybeGrantSignupBonus(email: string) {
  // Upsert user by email
  const upsert = await supabaseAdmin
    .from("users")
    .upsert({ email }, { onConflict: "email" })
    .select("id,email,credits")
    .single();

  if (upsert.error) throw upsert.error;
  const user = upsert.data;

  // Insert a signup bonus ledger row exactly once
  const ledger = await supabaseAdmin
    .from("credit_ledger")
    .insert({ user_id: user.id, type: "signup_bonus", amount: SIGNUP_BONUS })
    .select("id")
    .maybeSingle();

  // If the insert succeeded, add credits
  if (!ledger.error && ledger.data?.id) {
    const updated = await supabaseAdmin
      .from("users")
      .update({ credits: (user.credits ?? 0) + SIGNUP_BONUS })
      .eq("id", user.id)
      .select("id,email,credits")
      .single();

    if (updated.error) throw updated.error;
    return updated.data;
  }

  // If insert failed because it already exists, just return existing user
  return user;
}