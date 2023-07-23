import { Dictionary, chunk, groupBy } from "lodash";
import { getManifoldApi } from "./manifold-api";
import {
  computePayoutDistribution,
  ManifoldPosition,
  type PMF,
} from "./probability";
import {
  Manifold,
  type Bet,
  type User,
  LiteMarket,
} from "./vendor/manifold-sdk";
import { Outcome } from "./calculate";
import { ManifolioError } from "@/components/ErrorMessage";
import logger from "@/logger";

let marketsEndpointEnabled = false;
export const isMarketsEndpointEnabled = () => marketsEndpointEnabled;
const checkMarketsEndpointEnabled = async () => {
  const api = getManifoldApi();
  // Get 3 markets
  const markets = await api.getMarkets({ limit: 5 });

  // Try getting 2 of them by id (2nd and 4th ones)
  const marketIds = (await markets).map((market) => market.id);
  const marketsById = await api.getMarkets({
    ids: [marketIds[1], marketIds[3]],
    limit: 5,
  });

  // If we get back 2 markets, then the endpoint is enabled
  marketsEndpointEnabled = marketsById.length === 2;
};

void checkMarketsEndpointEnabled();
setInterval(checkMarketsEndpointEnabled, 60_000 * 5);

export class UserModel {
  user: User;
  balance: number;
  loans: number;
  balanceAfterLoans: number;
  positions: ManifoldPosition[];
  illiquidEV: number;
  portfolioEV: number;
  illiquidPmfCache: Record<string, PMF>;

  constructor(
    user: User,
    balance: number,
    loans: number,
    positions: ManifoldPosition[]
  ) {
    this.user = user;
    this.balance = balance;
    this.loans = loans;
    this.positions = positions;
    this.balanceAfterLoans = balance - loans;
    this.illiquidEV = positions.reduce(
      (acc, position) =>
        acc + (position.probability ?? 0) * (position.payout ?? 0),
      0
    );
    this.portfolioEV = this.balanceAfterLoans + this.illiquidEV;

    // First calculate the PMF _not_ excluding any markets, for the case where they
    // bet on something they haven't bet on before
    this.illiquidPmfCache = {
      all: computePayoutDistribution(
        positions,
        positions.length > 12 ? "monte-carlo" : "cartesian"
      ),
    };
  }

  /**
   * Get the probability mass function of the payouts of the user's portfolio, possibly excluding the market
   * with the given ID (for use when they are betting on a market they already have a position in)
   * @param excludingMarketId
   * @returns
   */
  getIlliquidPmf(excludingMarketId?: string): PMF {
    if (!excludingMarketId) {
      return this.illiquidPmfCache["all"];
    }

    if (this.illiquidPmfCache[excludingMarketId]) {
      return this.illiquidPmfCache[excludingMarketId];
    }

    const positionsExcludingMarket = this.positions.filter(
      (pos) => pos.contractId !== excludingMarketId
    );
    this.illiquidPmfCache[excludingMarketId] = computePayoutDistribution(
      positionsExcludingMarket,
      positionsExcludingMarket.length > 12 ? "monte-carlo" : "cartesian"
    );
    return this.illiquidPmfCache[excludingMarketId];
  }

  getPosition(contractId: string): ManifoldPosition | undefined {
    return this.positions.find((pos) => pos.contractId === contractId);
  }
}

export const fetchUser = async (
  username: string
): Promise<User | undefined> => {
  const api = getManifoldApi();

  try {
    const user = await api.getUser({ username });
    return user;
  } catch (e) {
    return undefined;
  }
};

export const buildUserModel = async (
  manifoldUser: User,
  pushError: (error: ManifolioError) => void = () => {},
  clearError: (key: string) => void = () => {},
  setNumBetsLoaded: (numBetsLoaded: number) => void = () => {}
): Promise<UserModel | undefined> => {
  const api = getManifoldApi();

  const { username } = manifoldUser;

  // Fetch bets with pagination
  // TODO combine with market.ts
  const allBets: Bet[] = [];
  let before: string | undefined = undefined;

  setNumBetsLoaded(0);
  while (true) {
    const bets = await api.getBets({ username, before, limit: 1000 });
    allBets.push(...bets);
    setNumBetsLoaded(allBets.length);

    // Break if:
    // - The latest page of bets is less than 1000 (indicating that there are no more pages)
    // - There are no bets at all
    // - There are no bets in the latest page (if the last page happened to be exactly 1000 bets)
    if (bets.length < 1000 || allBets.length === 0 || allBets.length === 0) {
      break;
    }

    before = allBets[allBets.length - 1].id;
  }

  // Fetch all the users bets, then construct positions from them
  // Note 1: partially filled bets still have the correct "amount" and "shares" fields
  // Note 2: including cancelled bets is also fine, this just refers to whether _new_ fills are cancelled
  const cpmmBets = allBets.filter(
    (bet) => bet.isFilled !== undefined || bet.amount < 0
  );
  // TODO handle these in some way
  // const nonCpmmBets = allBets.filter(
  //   (bet) => bet.isFilled === undefined && bet.amount > 0
  // );
  const betsByMarket = groupBy(cpmmBets, (bet) => bet.contractId);

  const cleanedContractsBetOn: Dictionary<{
    contractId: string;
    netYesShares: number;
    netLoan: number;
    evEstimate: number;
  }> = {};

  for (const marketId in betsByMarket) {
    const bets = betsByMarket[marketId].sort(
      (a, b) => b.createdTime - a.createdTime
    );
    const mostRecentProb = bets[0].probAfter;

    const netYesShares = bets.reduce((acc, bet) => {
      if (bet.outcome === "YES") {
        return acc + bet.shares;
      } else {
        return acc - bet.shares;
      }
    }, 0);
    const netLoan = bets.reduce((acc, bet) => acc + (bet.loanAmount ?? 0), 0);

    if (Math.abs(netYesShares) >= 1) {
      cleanedContractsBetOn[marketId] = {
        contractId: marketId,
        netYesShares: netYesShares,
        netLoan,
        // this is really just here for information architecture reasons, it's not necessary atm
        evEstimate: mostRecentProb * netYesShares,
      };
    }
  }

  const allMarketIds = Object.keys(cleanedContractsBetOn);

  const fetchMarkets = async (ids: string[]): Promise<LiteMarket[]> => {
    if (isMarketsEndpointEnabled()) {
      const marketChunks = await Promise.all(
        chunk(ids, 500).map(async (ids) => {
          const markets = await api.getMarkets({ ids, limit: 500 });
          return markets;
        })
      );
      return marketChunks.flat();
    }

    // Fall back to getting markets one by one
    logger.warn(
      `Falling back to getting markets one by one. Fetching ${ids.length} markets.`
    );

    // Sort the ids by abs(evEstimate - netLoan) descending, so that we fetch the most important ones first/
    // Then take the first 100 to avoid overfetching

    const allBets = Object.values(cleanedContractsBetOn);
    const sortedIds = allBets
      .sort(
        (a, b) =>
          Math.abs(b.evEstimate - b.netLoan) -
          Math.abs(a.evEstimate - a.netLoan)
      )
      .map((bet) => bet.contractId);
    const truncatedIds = sortedIds.slice(0, 100);

    if (truncatedIds.length < ids.length) {
      pushError({
        key: "positionsTruncated",
        code: "UNKNOWN_ERROR",
        message: `Only ${truncatedIds.length} of ${ids.length} positions could be loaded. This will mean that "Portfolio value" and "Total loans" may be incorrect. This is due to a limitation of the manifold API and will be fixed soon`,
        severity: "warning",
      });
    } else {
      clearError("positionsTruncated");
    }

    const markets = await Promise.all(
      truncatedIds.map(async (id) => {
        for (let i = 0; i < 5; i++) {
          try {
            const market = await api.getMarket({ id });
            return market;
          } catch (e) {
            logger.warn(`Failed to fetch market ${id} on attempt ${i + 1}`);
          }
        }
      })
    );
    return markets.filter((market) => market !== undefined) as LiteMarket[];
  };

  const markets = await fetchMarkets(allMarketIds);

  const openMarkets = markets.filter(
    (market) =>
      market.isResolved === false &&
      market.closeTime &&
      market.closeTime > Date.now() &&
      // FIXME this should have been handled above, check again + handle dpm-2 markets (at least in EV)
      market.mechanism === "cpmm-1"
  );

  const positions = openMarkets
    .map((market) => {
      const bet = cleanedContractsBetOn[market.id];
      if (!bet) return undefined;

      const isYesBet = bet.netYesShares > 0;

      const probability = isYesBet
        ? market.probability
        : 1 - market.probability;
      const payout = Math.abs(bet.netYesShares);

      return {
        probability,
        payout,
        loan: bet.netLoan,
        contractId: market.id,
        outcome: (isYesBet ? "YES" : "NO") as Outcome,
        marketName: market.question,
        // ev: probability * payout, // DEBUG
      };
    })
    .filter((pos) => pos !== undefined) as ManifoldPosition[];

  if (positions.length < openMarkets.length) {
    const discrepancy = openMarkets.length - positions.length;
    pushError({
      key: "userPositionMismatch",
      code: "UNKNOWN_ERROR",
      message: `${discrepancy} positions for user "${username}" could not be loaded. This will mean that "Portfolio value" and "Total loans" may be incorrect.`,
      severity: "warning",
    });
  } else {
    clearError("userPositionMismatch");
  }

  const loans = positions.reduce((acc, pos) => acc + (pos.loan ?? 0), 0);

  return new UserModel(manifoldUser, manifoldUser.balance, loans, positions);
};

export const getAuthedUsername = async (
  apiKey: string
): Promise<string | undefined> => {
  const api = new Manifold(apiKey);

  try {
    const user = await api.getMe();
    return user?.username;
  } catch (e) {
    return undefined;
  }
};
