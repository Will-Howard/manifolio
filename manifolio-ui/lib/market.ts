import { getManifoldApi } from "@/lib/manifold-api";
import { Bet, FullMarket } from "./vendor/manifold-sdk";

import {
  LimitBet,
  getBinaryCpmmBetInfo,
  getCpmmProbability,
} from "./vendor/manifold-helpers";

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
    this.bets = bets;
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

const buildCpmmMarketModelInner = async (
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
    userIds.map((userId) => getManifoldApi().getUser({ id: userId }))
  );
  const balanceByUserId = users.reduce((acc, user) => {
    if (user) {
      acc[user.id] = user.balance;
    }
    return acc;
  }, {} as { [userId: string]: number });

  return new CpmmMarketModel({ market, bets: allBets, balanceByUserId });
};

export const buildCpmmMarketModel = async (
  market: FullMarket
): Promise<CpmmMarketModel | undefined> => {
  try {
    return await buildCpmmMarketModelInner(market);
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
