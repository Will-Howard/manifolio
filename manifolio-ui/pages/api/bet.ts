// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { Manifold } from "@/lib/vendor/manifold-sdk";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    betId: string;
  }>
) {
  const { amount, outcome, marketId, apiKey } = req.body;
  const api = new Manifold(apiKey);

  const createResult = await api.createBet({
    amount: Math.round(amount),
    marketId,
    outcome,
  });

  res.status(200).json(createResult);
}
