import { Router } from "express";
import { supabase } from "../supabase";

export const marketsRouter = Router();

marketsRouter.get("/", async (_req, res) => {
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: "Database error", details: error.message });
  return res.status(200).json({ markets: data ?? [] });
});