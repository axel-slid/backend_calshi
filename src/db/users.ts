import { supabaseAdmin } from "../supabase";

const SIGNUP_BONUS = 1000;

export async function upsertUserAndMaybeGrantSignupBonus(email: string) {
  // Ensure user exists
  const upsert = await supabaseAdmin
    .from("users")
    .upsert({ email }, { onConflict: "email" })
    .select("id,email,credits,signup_bonus_granted")
    .single();

  if (upsert.error) throw upsert.error;
  const user = upsert.data;

  // Grant only once
  if (!user.signup_bonus_granted) {
    const updated = await supabaseAdmin
      .from("users")
      .update({
        credits: (user.credits ?? 0) + SIGNUP_BONUS,
        signup_bonus_granted: true,
      })
      .eq("id", user.id)
      .select("id,email,credits,signup_bonus_granted")
      .single();

    if (updated.error) throw updated.error;
    return updated.data;
  }

  return user;
}