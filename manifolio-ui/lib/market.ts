import { getManifoldApi } from "@/lib/manifold-api";
import { Bet, FullMarket } from "./vendor/manifold-sdk";

import {
  LimitBet,
  getBinaryCpmmBetInfo,
  getCpmmProbability,
} from "./vendor/manifold-helpers";
import { getSupabaseClient } from "./manifold-supabase-api";
import logger from "@/logger";
import { chunk } from "lodash";

export class CpmmMarketModel {
  public market: FullMarket;
  public bets: Bet[];
  public unfilledBets: Bet[];
  public balanceByUserId: Record<string, number>;

  constructor({
    market,
    bets,
    balanceByUserId,
  }: {
    market: FullMarket;
    bets: Bet[];
    balanceByUserId: Record<string, number>;
  }) {
    this.market = market;
    this.bets = bets; // FIXME we don't all bets at all, just unfilled ones
    this.unfilledBets = this.bets.filter(
      (bet) => bet.isFilled === false && bet.isCancelled === false
    );
    this.balanceByUserId = balanceByUserId;
  }

  getBetInfo = (
    outcome: "YES" | "NO",
    betAmount: number
  ): { probAfter: number; newShares: number } => {
    const { newPool, newP, newBet } = getBinaryCpmmBetInfo(
      outcome,
      betAmount,
      this.market as FullMarket,
      undefined,
      this.unfilledBets as LimitBet[], // TODO better type checking
      this.balanceByUserId
    );

    const newShares = newBet.shares;
    return { probAfter: getCpmmProbability(newPool, newP), newShares };
  };
}

const buildCpmmMarketModelInnerV0Api = async (
  market: FullMarket
): Promise<CpmmMarketModel> => {
  const api = getManifoldApi();

  // Fetch bets with pagination
  // TODO combine with market.ts
  const allBets: Bet[] = [];
  let before: string | undefined = undefined;

  // TODO I think we don't actually need all bets, just the unfilled ones
  while (true) {
    const bets = await api.getBets({
      marketId: market.id,
      before,
      limit: 1000,
    });
    allBets.push(...bets);

    // Break if:
    // - The latest page of bets is less than 1000 (indicating that there are no more pages)
    // - There are no bets at all
    // - There are no bets in the latest page (if the last page happened to be exactly 1000 bets)
    if (bets.length < 1000 || allBets.length === 0 || allBets.length === 0) {
      break;
    }

    before = allBets[allBets.length - 1].id;
  }

  // Calculate balanceByUserId
  const unfilledBets = allBets.filter(
    (bet) => bet.isFilled === false && bet.isCancelled === false
  );
  const userIds = [...new Set(unfilledBets.map((bet) => bet.userId))];

  const users = await Promise.all(
    userIds.map((userId) => api.getUser({ id: userId }))
  );
  const balanceByUserId = users.reduce((acc, user) => {
    if (user) {
      acc[user.id] = user.balance;
    }
    return acc;
  }, {} as { [userId: string]: number });

  return new CpmmMarketModel({ market, bets: allBets, balanceByUserId });
};

const buildCpmmMarketModelInnerSupabaseApi = async (
  market: FullMarket
): Promise<CpmmMarketModel> => {
  const client = getSupabaseClient();

  const { data: limitBets } = await client
    .from("contract_bets")
    .select("*")
    .eq("contract_id", market.id)
    .eq("data->>isFilled", false)
    .eq("data->>isCancelled", false)
    .eq("is_ante", false)
    .eq("is_redemption", false)
    // Don't filter on expiresAt here, do it manaully because I don't trust null/undefined handling
    .limit(1000);

  const flattenedBets = (limitBets ?? []).map((bet) => bet?.data) as LimitBet[];
  const nonExpiredBets = flattenedBets.filter(
    (bet) => !bet.expiresAt || bet.expiresAt > Date.now()
  );

  const userIds = [...new Set(nonExpiredBets.map((bet) => bet.userId))];

  // Split the userIds into chunks of 200
  const userIdChunks = chunk(userIds, 200);

  let users: { id: string; balance: string }[] = [];

  for (const chunk of userIdChunks) {
    const { data: chunkUsers } = await client
      .from("users")
      .select("id, data->>balance")
      .in("id", chunk)
      .limit(chunk.length);

    users = [...users, ...(chunkUsers ?? [])];
  }

  const balanceByUserId = (users ?? []).reduce((acc, user) => {
    try {
      if (user) {
        acc[user.id] = parseFloat(user.balance);
      }
    } catch (e) {
      logger.error("error parsing balance", user, e);
    }
    return acc;
  }, {} as { [userId: string]: number });

  return new CpmmMarketModel({ market, bets: nonExpiredBets, balanceByUserId });
};

export const buildCpmmMarketModel = async (
  market: FullMarket
): Promise<CpmmMarketModel | undefined> => {
  try {
    // return await buildCpmmMarketModelInnerV0Api(market);
    return await buildCpmmMarketModelInnerSupabaseApi(market);
  } catch (e) {
    // TODO distinguish unexpected errors from 404s
    return undefined;
  }
};

export const fetchMarket = async (
  slug: string
): Promise<FullMarket | undefined> => {
  const api = getManifoldApi();

  try {
    const market = await api.getMarket({ slug });
    return market;
  } catch (e) {
    return undefined;
  }
};
