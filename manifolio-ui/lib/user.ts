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
  FullMarket,
} from "./vendor/manifold-sdk";
import { Outcome } from "./calculate";
import { ManifolioError } from "@/components/ErrorMessage";
import logger from "@/logger";
import { getCpmmProbability } from "./vendor/manifold-helpers";
import { getSupabaseClient, supabaseToV0Market } from "./manifold-supabase-api";

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

const fetchMarketsByIds = async ({
  ids,
  api,
  pushError = () => {},
  clearError = () => {},
  oneByOne = false,
}: {
  ids: string[];
  api: Manifold;
  pushError?: (error: ManifolioError) => void;
  clearError?: (key: string) => void;
  oneByOne?: boolean;
}): Promise<LiteMarket[]> => {
  if (!oneByOne && isMarketsEndpointEnabled()) {
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
  const truncatedIds = ids.slice(0, 10);

  if (truncatedIds.length < ids.length) {
    pushError({
      key: "positionsTruncated",
      code: "UNKNOWN_ERROR",
      message: `Only ${truncatedIds.length} of ${ids.length} positions fetched to avoid overloading the Manifold API. This will mean that "Portfolio value" and "Total loans" may be incorrect. This limitation will be fixed soon.`,
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

const calculateCpmm1Positions = (
  contractsWithNetPositions: Dictionary<{
    contractId: string;
    netYesShares: number;
    netLoan: number;
  }>,
  markets: LiteMarket[]
): ManifoldPosition[] => {
  const outcomeTypes: Record<string, "BINARY" | "NUMERIC" | "STOCK"> = {
    BINARY: "BINARY",
    PSEUDO_NUMERIC: "NUMERIC",
    STONK: "STOCK",
  };
  return markets
    .map((market) => {
      const bet = contractsWithNetPositions[market.id];
      if (!bet) return undefined;

      if (!market.p) return;

      // Stock markets don't return a probability, but we can calculate it
      const marketProb =
        market.probability ?? getCpmmProbability(market.pool, market.p);

      const isYesBet = bet.netYesShares > 0;
      const probability = isYesBet ? marketProb : 1 - marketProb;
      const payout = Math.abs(bet.netYesShares);

      return {
        probability,
        payout,
        loan: bet.netLoan,
        contractId: market.id,
        outcome: (isYesBet ? "YES" : "NO") as Outcome,
        marketName: market.question,
        type: outcomeTypes[market.outcomeType] ?? "BINARY",
      };
    })
    .filter((pos) => pos !== undefined) as ManifoldPosition[];
};

const calculateMultipleChoicePositions = async ({
  bets,
}: {
  bets: Bet[];
}): Promise<ManifoldPosition[]> => {
  // - Group markets by answerId
  // - Calculate netYesShares by answer
  // - Fetch the full markets for those with non-zero netYesShares (FullMarket is required to get the answer probabilities)
  // - Calculate the positions for each answer

  const cleanedBets = bets.filter((bet) => bet.answerId !== undefined);
  const betsByAnswer = groupBy(
    cleanedBets,
    (bet) => `${bet.contractId}_${bet.answerId}`
  );

  const answersWithNetPositions: Dictionary<{
    contractId: string;
    answerId: string;
    netYesShares: number;
    netLoan: number;
    evEstimate: number;
  }> = {};

  for (const key in betsByAnswer) {
    const bets = betsByAnswer[key].sort(
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
      answersWithNetPositions[key] = {
        contractId: bets[0].contractId,
        answerId: bets[0].answerId as string,
        netYesShares: netYesShares,
        netLoan,
        // this is really just here for information architecture reasons, it's not necessary atm
        evEstimate: mostRecentProb * netYesShares,
      };
    }
  }

  const openMarketIds = [
    ...new Set(
      Object.values(answersWithNetPositions).map(
        (bet) => bet.contractId as string
      )
    ),
  ];

  if (openMarketIds.length === 0) return [];

  const fullMarkets = (await fetchMarketsByIds({
    ids: openMarketIds,
    api: getManifoldApi(),
    oneByOne: true,
  })) as FullMarket[];
  const fullMarketById = groupBy(fullMarkets, (market) => market.id);

  const positions = Object.values(answersWithNetPositions)
    .map((bet) => {
      const market = fullMarketById[bet.contractId][0];

      if (!market || !market.answers) return undefined;

      const answer = market.answers.find(
        (answer) => answer.id === bet.answerId
      );

      if (!answer) return undefined;

      const isYesBet = bet.netYesShares > 0;
      const probability = isYesBet
        ? answer.probability
        : 1 - answer.probability;
      const payout = Math.abs(bet.netYesShares);

      return {
        probability,
        payout,
        loan: bet.netLoan,
        contractId: market.id,
        outcome: (isYesBet ? "YES" : "NO") as Outcome,
        marketName: market.question,
        type: "MULTIPLE_CHOICE",
      };
    })
    .filter((pos) => pos !== undefined) as ManifoldPosition[];

  return positions;
};

const calculateFreeResponsePositions = async (
  markets: LiteMarket[],
  bets: Bet[]
): Promise<ManifoldPosition[]> => {
  // FIXME I have punted this for now because the dpm-2 payout logic is complicated, and I think there
  // isn't enough info in the Market object to calculate it. See calculateStandardDpmPayout for how it is
  // calculated
  return [];
};

const buildUserModelInnerSupabaseApi = async (
  manifoldUser: User,
  pushError: (error: ManifolioError) => void = () => {},
  clearError: (key: string) => void = () => {},
  setNumBetsLoaded: (numBetsLoaded: number) => void = () => {},
  extraBets: Bet[] = []
): Promise<UserModel | undefined> => {
  const client = getSupabaseClient();

  const { data: contractMetrics } = await client
    .from("user_contract_metrics")
    .select()
    .eq("user_id", manifoldUser.id)
    .limit(1000);

  const contractIds = [
    ...new Set(
      (contractMetrics ?? [])
        .map((pos) => pos?.data?.contractId)
        .filter((id) => id !== undefined) as string[]
    ),
  ];
  const contractMetricsByContractId = groupBy(
    contractMetrics,
    (pos) => pos?.data?.contractId
  );

  logger.debug("user_contract_metrics", contractMetrics);
  logger.debug("contractIds", contractIds);

  // Split contractIds into chunks of 200
  const contractIdChunks = [];
  for (let i = 0; i < contractIds.length; i += 200) {
    contractIdChunks.push(contractIds.slice(i, i + 200));
  }

  let unresolvedMarketsRaw: any[] = [];

  for (const chunk of contractIdChunks) {
    const { data: chunkMarkets } = await client
      .from("contracts")
      .select()
      .in("id", chunk)
      .eq("data->>isResolved", false)
      .limit(chunk.length);

    unresolvedMarketsRaw = [...unresolvedMarketsRaw, ...(chunkMarkets ?? [])];
  }

  logger.debug("contracts", unresolvedMarketsRaw);

  const unresolvedMarkets = unresolvedMarketsRaw.map((m) =>
    supabaseToV0Market(m)
  );

  logger.debug("unresolvedMarkets", unresolvedMarkets);

  const filterMarketsAndMetrics = (
    markets: LiteMarket[],
    predicate: (
      value: LiteMarket,
      index: number,
      array: LiteMarket[]
    ) => boolean
  ) => {
    const filteredMarkets = markets.filter(predicate);
    // get metrics for filtered markets
    const filteredContractIds = filteredMarkets.map((m) => m.id);
    const filteredContractMetrics = filteredContractIds
      .map((id) => contractMetricsByContractId[id])
      .flat();

    return [filteredMarkets, filteredContractMetrics];
  };

  const [binaryMarkets, binaryMarketMetrics] = filterMarketsAndMetrics(
    unresolvedMarkets,
    (market) =>
      market.mechanism === "cpmm-1" &&
      ["BINARY", "PSEUDO_NUMERIC", "STONK"].includes(market.outcomeType)
  );

  // Format into what calculateCpmm1Positions expects
  const binaryMetricsFormatted: Dictionary<{
    contractId: string;
    netYesShares: number;
    netLoan: number;
  }> = binaryMarketMetrics.reduce((acc, metric) => {
    const netYesShares = metric.total_shares_yes - metric.total_shares_no;
    const netLoan = metric.data?.loan ?? 0;

    if (Math.abs(netYesShares) >= 1) {
      acc[metric.data?.contractId] = {
        contractId: metric.data?.contractId,
        netYesShares: netYesShares,
        netLoan,
      };
    }
    return acc;
  }, {});

  const binaryPositions = calculateCpmm1Positions(
    binaryMetricsFormatted,
    binaryMarkets
  );

  // For now, just treat all non-cpmm-1 markets as resolving to their expected value with probability 1
  const [nonBinaryMarkets, nonBinaryMarketMetrics] = filterMarketsAndMetrics(
    unresolvedMarkets,
    (market) =>
      !(
        market.mechanism === "cpmm-1" &&
        ["BINARY", "PSEUDO_NUMERIC", "STONK"].includes(market.outcomeType)
      )
  );

  const nonBinaryPositions: ManifoldPosition[] = nonBinaryMarketMetrics
    .filter((metric) => Math.abs(metric.data?.payout ?? 0) >= 1)
    .map((metric) => {
      const market = nonBinaryMarkets.find(
        (market) => market.id === metric.data?.contractId
      );

      return {
        probability: 1,
        // NOTE: metric.data?.payout is the expected value of the market, not the payout on success
        payout: metric.data?.payout ?? 0,
        loan: metric.data?.loan ?? 0,
        contractId: metric.data?.contractId ?? "",
        marketName: market?.question,
        type: market?.outcomeType ?? "FREE_RESPONSE",
      };
    });

  const positions = [...binaryPositions, ...nonBinaryPositions];

  const loans = positions.reduce((acc, pos) => acc + (pos.loan ?? 0), 0);

  return new UserModel(manifoldUser, manifoldUser.balance, loans, positions);
};

const buildUserModelInnerV0Api = async (
  manifoldUser: User,
  pushError: (error: ManifolioError) => void = () => {},
  clearError: (key: string) => void = () => {},
  setNumBetsLoaded: (numBetsLoaded: number) => void = () => {},
  extraBets: Bet[] = []
): Promise<UserModel | undefined> => {
  const api = getManifoldApi();

  const { username } = manifoldUser;

  // Fetch bets with pagination
  // TODO combine with market.ts
  const fetchedBets: Bet[] = [];
  let before: string | undefined = undefined;

  setNumBetsLoaded(0);
  while (true) {
    const bets = await api.getBets({ username, before, limit: 1000 });
    fetchedBets.push(...bets);
    setNumBetsLoaded(fetchedBets.length);

    // Break if:
    // - The latest page of bets is less than 1000 (indicating that there are no more pages)
    // - There are no bets at all
    // - There are no bets in the latest page (if the last page happened to be exactly 1000 bets)
    if (
      bets.length < 1000 ||
      fetchedBets.length === 0 ||
      fetchedBets.length === 0
    ) {
      break;
    }

    before = fetchedBets[fetchedBets.length - 1].id;
  }

  const allBets = [...new Set([...fetchedBets, ...extraBets])];

  // Fetch all the users bets, then construct positions from them
  // Note 1: partially filled bets still have the correct "amount" and "shares" fields
  // Note 2: including cancelled bets is also fine. This just refers to whether _new_ fills are cancelled, which does not affect the amount field
  const probablyBinaryBets = allBets.filter(
    (bet) => bet.isFilled !== undefined || bet.amount < 0
  );
  const otherBets = allBets.filter(
    (bet) => bet.isFilled === undefined && bet.amount > 0
  );

  const betsByMarket = groupBy(probablyBinaryBets, (bet) => bet.contractId);

  const contractsWithNetPositions: Dictionary<{
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
      contractsWithNetPositions[marketId] = {
        contractId: marketId,
        netYesShares: netYesShares,
        netLoan,
        // this is really just here for information architecture reasons, it's not necessary atm
        evEstimate: mostRecentProb * netYesShares,
      };
    }
  }

  // Order by magnitiude of net EV first, then other bets where we don't know the EV. This is in case we have to truncate the list
  const contractsWithNetPositionIds = Object.values(contractsWithNetPositions)
    .sort(
      (a, b) =>
        Math.abs(b.evEstimate - b.netLoan) - Math.abs(a.evEstimate - a.netLoan)
    )
    .map((bet) => bet.contractId);
  const allMarketIds = [
    ...contractsWithNetPositionIds,
    ...new Set(otherBets.map((bet) => bet.contractId)),
  ];

  const markets = await fetchMarketsByIds({
    ids: allMarketIds,
    api,
    pushError,
    clearError,
  });

  const openMarkets = markets.filter(
    (market) =>
      market.isResolved === false &&
      // FIXME this is wrong, we actually do want to include markets that are closed but not yet resolved.
      // Probably I won't fix this because I'm switching to the supabase version anyway
      market.closeTime &&
      market.closeTime > Date.now()
  );

  // There are 6 types of question filterable at https://manifold.markets/questions:
  //  - YES/NO (cpmm-1)
  //  - Multiple choice (cpmm-multi-1)
  //  - Free response (dpm-2, not yet implemented)
  //  - Numeric (cpmm-1)
  //  - Bounties (not really a market)
  //  - Stock (cpmm-1)

  const openBinaryMarkets = openMarkets.filter(
    (market) =>
      market.mechanism === "cpmm-1" &&
      ["BINARY", "PSEUDO_NUMERIC", "STONK"].includes(market.outcomeType)
  );

  const openMultipleChoiceMarkets = openMarkets.filter(
    (market) =>
      // FIXME bug in the api library here, "cpmm-multi-1" is not a valid mechanism
      (market.mechanism as string) === "cpmm-multi-1" &&
      market.outcomeType === "MULTIPLE_CHOICE"
  );
  // FIXME there may be 100,000s of bets, use a more efficient algorithm
  const openMultipleChoiceBets = allBets.filter(
    (bet) =>
      bet.answerId &&
      openMultipleChoiceMarkets.find(
        (market) => market.id === bet.contractId
      ) !== undefined
  );

  const openFreeResponseMarkets = openMarkets.filter(
    (market) =>
      market.mechanism === "dpm-2" && market.outcomeType === "FREE_RESPONSE"
  );
  // FIXME there may be 100,000s of bets, use a more efficient algorithm
  const openFreeResponseBets = allBets.filter(
    (bet) =>
      bet.outcome &&
      openFreeResponseMarkets.find((market) => market.id === bet.contractId) !==
        undefined
  );

  // Ignore bounties, they have no bets

  const positions = [
    ...calculateCpmm1Positions(contractsWithNetPositions, openBinaryMarkets),
    ...(await calculateMultipleChoicePositions({
      bets: openMultipleChoiceBets,
    })),
    ...(await calculateFreeResponsePositions(
      openFreeResponseMarkets,
      openFreeResponseBets
    )),
  ];

  const uniquePositionMarketIds = [
    ...new Set(positions.map((pos) => pos.contractId)),
  ];
  if (uniquePositionMarketIds.length < openMarkets.length) {
    const discrepancy = openMarkets.length - uniquePositionMarketIds.length;
    pushError({
      key: "userPositionMismatch",
      code: "UNKNOWN_ERROR",
      message: `${discrepancy} position${
        discrepancy > 1 ? "s" : ""
      } for user "${username}" could not be loaded. This will probably cause an under-estimate of portfolio value and hence a bet recommendation that is too low, although this is not guaranteed if you have a lot of loans.`,
      severity: "warning",
    });
  } else {
    clearError("userPositionMismatch");
  }

  const loans = positions.reduce((acc, pos) => acc + (pos.loan ?? 0), 0);

  return new UserModel(manifoldUser, manifoldUser.balance, loans, positions);
};

export const buildUserModel = async (
  manifoldUser: User,
  pushError: (error: ManifolioError) => void = () => {},
  clearError: (key: string) => void = () => {},
  setNumBetsLoaded: (numBetsLoaded: number) => void = () => {},
  extraBets: Bet[] = []
): Promise<UserModel | undefined> => {
  try {
    // return await buildUserModelInnerV0Api(
    //   manifoldUser,
    //   pushError,
    //   clearError,
    //   setNumBetsLoaded,
    //   extraBets
    // );
    return await buildUserModelInnerSupabaseApi(
      manifoldUser,
      pushError,
      clearError,
      setNumBetsLoaded,
      extraBets
    );
  } catch (e) {
    logger.error(`Error building user model for ${manifoldUser.username}`, e);
    pushError({
      key: "userModelError",
      code: "UNKNOWN_ERROR",
      message: `Error building user model for ${manifoldUser.username}`,
      severity: "error",
    });
    return undefined;
  }
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
