// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { getAuthedUsername } from "@/lib/user";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    username: string | undefined;
  }>
) {
  const { apiKey } = req.body;
  const username = await getAuthedUsername(apiKey);

  res.status(200).json({ username });
}
