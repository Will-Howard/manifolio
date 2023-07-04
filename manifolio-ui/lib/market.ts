import { getManifoldApi } from "@/lib/manifold-api";
import { Bet, FullMarket } from "./vendor/manifold-sdk";

import logger from "@/logger";
import {
  LimitBet,
  getBinaryCpmmBetInfo,
  getCpmmProbability,
} from "./vendor/manifold-helpers";

const cache: Record<string, CachedMarket> = {};

class CachedMarket {
  private timestamp: number;
  private ttl: number = 1000 * 30; // 30 seconds
  public slug: string;
  private market: FullMarket | null = null;
  private bets: Bet[] | null = null;
  private balanceByUserId: Record<string, number> | null = null;
  public marketPromise: Promise<FullMarket | undefined>;
  public betsPromise: Promise<Bet[] | undefined>;
  public balanceByUserIdPromise: Promise<Record<string, number> | undefined>;

  constructor(slug: string) {
    this.slug = slug;
    this.timestamp = Date.now();

    // Fetch market and bets when the instance is created
    this.marketPromise = this.fetchMarket();
    this.betsPromise = this.fetchBets();
    this.balanceByUserIdPromise = this.fetchBalanceByUserId();
  }

  private async fetchMarket() {
    try {
      this.market = await getManifoldApi().getMarket({ slug: this.slug });
      return this.market;
    } catch (e) {
      console.error(e);
    }
  }

  private async fetchBets() {
    try {
      this.bets = await getManifoldApi().getBets({ marketSlug: this.slug });

      if (this.bets.length > 999) {
        throw new Error("Too many bets (Not implemented pagination)");
      }

      return this.bets;
    } catch (e) {
      console.error(e);
    }
  }

  private async fetchBalanceByUserId() {
    try {
      // Waits for the bets to be fetched and return them
      const bets = await this.getBets();
      if (!bets) {
        logger.error("Bets not found while fetching balanceByUserId");
        return;
      }

      const unfilledBets = bets.filter(
        (bet) => bet.isFilled === false && bet.isCancelled === false
      );
      const userIds = unfilledBets.map((bet) => bet.userId);

      const users = await Promise.all(
        userIds.map((userId) => getManifoldApi().getUser({ id: userId }))
      );
      this.balanceByUserId = users.reduce((acc, user) => {
        if (user) {
          acc[user.id] = user.balance;
        }
        return acc;
      }, {} as { [userId: string]: number });
      return this.balanceByUserId;
    } catch (e) {
      console.error(e);
    }
  }

  public async getMarket() {
    this.tryRefreshCache();
    // Wait for the market to be fetched and return it
    return this.market || (await this.marketPromise);
  }

  public async getBets() {
    this.tryRefreshCache();
    // Wait for the bets to be fetched and return them
    return this.bets || (await this.betsPromise);
  }

  public async getBalanceByUserId() {
    this.tryRefreshCache();
    // Wait for the balanceByUserId to be calculated and return it
    return this.balanceByUserId || (await this.balanceByUserIdPromise);
  }

  private tryRefreshCache() {
    const currentTime = Date.now();
    if (currentTime - this.timestamp > this.ttl) {
      this.timestamp = currentTime;
      this.marketPromise = this.fetchMarket();
      this.betsPromise = this.fetchBets();
      this.balanceByUserIdPromise = this.fetchBalanceByUserId();
    }
  }
}

export const fetchMarketCached = async ({
  slug,
}: {
  slug: string;
}): Promise<CachedMarket> => {
  if (cache[slug] && cache[slug]) {
    return cache[slug];
  }

  const cachedMarket = new CachedMarket(slug);
  cache[slug] = cachedMarket;
  return cachedMarket;
};

export const getBinaryCpmmBetInfoWrapper = async (
  outcome: "YES" | "NO",
  betAmount: number,
  marketSlug: string
) => {
  const market = await fetchMarketCached({ slug: marketSlug });
  const bets = await market.getBets(); // TODO maybe refactor to hide less abstraction here
  const balanceByUserId = await market.getBalanceByUserId();

  if (!market || !bets || !balanceByUserId) {
    logger.info("market or bets not found");
    logger.info("market", market);
    logger.info("bets", bets);
    logger.info("market.balanceByUserId", balanceByUserId);
    return { newP: 0, newShares: 0 };
  }

  const unfilledBets = bets.filter(
    (bet) => bet.isFilled === false && bet.isCancelled === false
  );

  const { newPool, newP, newBet } = getBinaryCpmmBetInfo(
    outcome,
    betAmount,
    (await market.getMarket()) as FullMarket,
    undefined,
    unfilledBets as LimitBet[], // TODO better type checking
    balanceByUserId
  );

  const newShares = newBet.shares;
  return { probAfter: getCpmmProbability(newPool, newP), newShares };
};

class CpmmMarketModel {
  public market: FullMarket; // TODO it would be nice to use a pared down version of this
  public bets: Bet[];
  public unfilledBets: Bet[];
  public balanceByUserId: Record<string, number>; // TODO refactor to include these in the LimitBets (but not now)

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

export const buildCpmmMarketModel = async (slug: string) => {
  const api = getManifoldApi();

  // Fetch market
  const market = await api.getMarket({ slug });

  // Fetch bets with pagination
  const allBets: Bet[] = [];
  let before: string | undefined = undefined;

  while (true) {
    const bets = await api.getBets({ marketSlug: slug, before, limit: 1000 });
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
