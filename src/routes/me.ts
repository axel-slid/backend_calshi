import { Router } from "express";

export const meRouter = Router();

meRouter.get("/", (req, res) => {
  // @ts-ignore
  const user = req.session?.user ?? null;
  // @ts-ignore
  const sessionToken = req.session?.sessionToken ?? null;
  res.status(200).json({ user, sessionToken });
});