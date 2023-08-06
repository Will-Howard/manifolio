// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { Manifold } from "@/lib/vendor/manifold-sdk";
import type { NextApiRequest, NextApiResponse } from "next";
import { client, v2 } from "@datadog/datadog-api-client";

const configuration = client.createConfiguration();
const apiInstance = new v2.MetricsApi(configuration);

const submitDatadogMetric = async (
  amount: number,
  username: string,
  success: boolean
) => {
  const params: v2.MetricsApiSubmitMetricsRequest = {
    body: {
      series: [
        {
          metric: "manifolio.bet",
          type: 1, // count
          points: [
            {
              timestamp: Math.round(new Date().getTime() / 1000),
              value: amount,
            },
          ],
          resources: [
            {
              name: "vercel",
              type: "host",
            },
          ],
          tags: [
            `success:${success}`,
            `username:${username}`,
            `env:${process.env.NEXT_PUBLIC_ENV || "dev"}`,
          ],
        },
      ],
    },
  };

  await apiInstance.submitMetrics(params);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{
    betId: string;
  }>
) {
  const { amount, outcome, marketId, apiKey, username } = req.body;
  const api = new Manifold(apiKey);

  try {
    const createResult = await api.createBet({
      amount: Math.round(amount),
      marketId,
      outcome,
    });

    await submitDatadogMetric(amount, username, true);

    res.status(200).json(createResult);
  } catch (e) {
    await submitDatadogMetric(amount, username, false);
    res.status(500).json({ betId: "" });
  }
}
