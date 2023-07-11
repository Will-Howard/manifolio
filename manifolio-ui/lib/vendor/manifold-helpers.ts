/**
 * These are functions and types copied from the main manifold codebase (https://github.com/manifoldmarkets/manifold)
 */
import { sortBy, sumBy, union } from "lodash";
import { Bet, LiteMarket, fill } from "./manifold-sdk";

type LimitProps = {
  orderAmount: number; // Amount of limit order.
  limitProb: number; // [0, 1]. Bet to this probability.
  isFilled: boolean; // Whether all of the bet amount has been filled.
  isCancelled: boolean; // Whether to prevent any further fills.
  // A record of each transaction that partially (or fully) fills the orderAmount.
  // I.e. A limit order could be filled by partially matching with several bets.
  // Non-limit orders can also be filled by matching with multiple limit orders.
  fills: fill[];
};

// Binary market limit order.
export type LimitBet = Bet & LimitProps;

type Fees = {
  creatorFee: number;
  platformFee: number;
  liquidityFee: number;
};

const noFees: Fees = {
  creatorFee: 0,
  platformFee: 0,
  liquidityFee: 0,
};

type CandidateBet<T extends Bet = Bet> = Omit<
  T,
  "id" | "userId" | "userAvatarUrl" | "userName" | "userUsername"
>;

type CpmmState = {
  pool: { [outcome: string]: number };
  p: number;
};

const removeUndefinedProps = <T extends object>(obj: T): T => {
  const newObj = {} as T;

  for (const key of Object.keys(obj) as Array<keyof T>) {
    if (obj[key] !== undefined) {
      newObj[key] = obj[key];
    }
  }

  return newObj;
};

const EPSILON = 0.00000001;

function floatingEqual(a: number, b: number, epsilon = EPSILON) {
  return Math.abs(a - b) < epsilon;
}

function floatingGreaterEqual(a: number, b: number, epsilon = EPSILON) {
  return a + epsilon >= b;
}

function floatingLesserEqual(a: number, b: number, epsilon = EPSILON) {
  return a - epsilon <= b;
}

export function getCpmmProbability(
  pool: { [outcome: string]: number },
  p: number
) {
  const { YES, NO } = pool;
  return (p * NO) / ((1 - p) * YES + p * NO);
}

function binarySearch(
  min: number,
  max: number,
  comparator: (x: number) => number
) {
  let mid = 0;
  while (true) {
    mid = min + (max - min) / 2;

    // Break once we've reached max precision.
    if (mid === min || mid === max) break;

    const comparison = comparator(mid);
    if (comparison === 0) break;
    else if (comparison > 0) {
      max = mid;
    } else {
      min = mid;
    }
  }
  return mid;
}

// before liquidity fee
function calculateCpmmShares(
  pool: {
    [outcome: string]: number;
  },
  p: number,
  bet: number,
  betChoice: string
) {
  const { YES: y, NO: n } = pool;
  const k = y ** p * n ** (1 - p);

  return betChoice === "YES"
    ? // https://www.wolframalpha.com/input?i=%28y%2Bb-s%29%5E%28p%29*%28n%2Bb%29%5E%281-p%29+%3D+k%2C+solve+s
      y + bet - (k * (bet + n) ** (p - 1)) ** (1 / p)
    : n + bet - (k * (bet + y) ** -p) ** (1 / (1 - p));
}

function getCpmmLiquidity(pool: { [outcome: string]: number }, p: number) {
  const { YES, NO } = pool;
  return YES ** p * NO ** (1 - p);
}

function addCpmmLiquidity(
  pool: { [outcome: string]: number },
  p: number,
  amount: number
) {
  const prob = getCpmmProbability(pool, p);

  //https://www.wolframalpha.com/input?i=p%28n%2Bb%29%2F%28%281-p%29%28y%2Bb%29%2Bp%28n%2Bb%29%29%3Dq%2C+solve+p
  const { YES: y, NO: n } = pool;
  const numerator = prob * (amount + y);
  const denominator = amount - n * (prob - 1) + prob * y;
  const newP = numerator / denominator;

  const newPool = { YES: y + amount, NO: n + amount };

  const oldLiquidity = getCpmmLiquidity(pool, newP);
  const newLiquidity = getCpmmLiquidity(newPool, newP);
  const liquidity = newLiquidity - oldLiquidity;

  return { newPool, liquidity, newP };
}

function getCpmmProbabilityAfterBetBeforeFees(
  state: CpmmState,
  outcome: string,
  bet: number
) {
  const { pool, p } = state;
  const shares = calculateCpmmShares(pool, p, bet, outcome);
  const { YES: y, NO: n } = pool;

  const [newY, newN] =
    outcome === "YES"
      ? [y - shares + bet, n + bet]
      : [y + bet, n - shares + bet];

  return getCpmmProbability({ YES: newY, NO: newN }, p);
}

const PLATFORM_FEE = 0;
const CREATOR_FEE = 0;
const LIQUIDITY_FEE = 0;

function getCpmmFees(state: CpmmState, bet: number, outcome: string) {
  const prob = getCpmmProbabilityAfterBetBeforeFees(state, outcome, bet);
  const betP = outcome === "YES" ? 1 - prob : prob;

  const liquidityFee = LIQUIDITY_FEE * betP * bet;
  const platformFee = PLATFORM_FEE * betP * bet;
  const creatorFee = CREATOR_FEE * betP * bet;
  const fees: Fees = { liquidityFee, platformFee, creatorFee };

  const totalFees = liquidityFee + platformFee + creatorFee;
  const remainingBet = bet - totalFees;

  return { remainingBet, totalFees, fees };
}

function calculateCpmmPurchase(state: CpmmState, bet: number, outcome: string) {
  const { pool, p } = state;
  const { remainingBet, fees } = getCpmmFees(state, bet, outcome);

  const shares = calculateCpmmShares(pool, p, remainingBet, outcome);
  const { YES: y, NO: n } = pool;

  const { liquidityFee: fee } = fees;

  const [newY, newN] =
    outcome === "YES"
      ? [y - shares + remainingBet + fee, n + remainingBet + fee]
      : [y + remainingBet + fee, n - shares + remainingBet + fee];

  const postBetPool = { YES: newY, NO: newN };

  const { newPool, newP } = addCpmmLiquidity(postBetPool, p, fee);

  return { shares, newPool, newP, fees };
}

function getCpmmOutcomeProbabilityAfterBet(
  state: CpmmState,
  outcome: string,
  bet: number
) {
  const { newPool } = calculateCpmmPurchase(state, bet, outcome);
  const p = getCpmmProbability(newPool, state.p);
  return outcome === "NO" ? 1 - p : p;
}

// Note: there might be a closed form solution for this.
// If so, feel free to switch out this implementation.
function calculateCpmmAmountToProb(
  state: CpmmState,
  prob: number,
  outcome: "YES" | "NO"
) {
  if (prob <= 0 || prob >= 1 || isNaN(prob)) return Infinity;
  if (outcome === "NO") prob = 1 - prob;

  // First, find an upper bound that leads to a more extreme probability than prob.
  let maxGuess = 10;
  let newProb = 0;
  do {
    maxGuess *= 10;
    newProb = getCpmmOutcomeProbabilityAfterBet(state, outcome, maxGuess);
  } while (newProb < prob);

  // Then, binary search for the amount that gets closest to prob.
  const amount = binarySearch(0, maxGuess, (amount) => {
    const newProb = getCpmmOutcomeProbabilityAfterBet(state, outcome, amount);
    return newProb - prob;
  });

  return amount;
}

const computeFill = (
  amount: number,
  outcome: "YES" | "NO",
  limitProb: number | undefined,
  cpmmState: CpmmState,
  matchedBet: LimitBet | undefined
) => {
  const prob = getCpmmProbability(cpmmState.pool, cpmmState.p);

  if (
    limitProb !== undefined &&
    (outcome === "YES"
      ? floatingGreaterEqual(prob, limitProb) &&
        (matchedBet?.limitProb ?? 1) > limitProb
      : floatingLesserEqual(prob, limitProb) &&
        (matchedBet?.limitProb ?? 0) < limitProb)
  ) {
    // No fill.
    return undefined;
  }

  const timestamp = Date.now();

  if (
    !matchedBet ||
    (outcome === "YES"
      ? !floatingGreaterEqual(prob, matchedBet.limitProb)
      : !floatingLesserEqual(prob, matchedBet.limitProb))
  ) {
    // Fill from pool.
    const limit = !matchedBet
      ? limitProb
      : outcome === "YES"
      ? Math.min(matchedBet.limitProb, limitProb ?? 1)
      : Math.max(matchedBet.limitProb, limitProb ?? 0);

    const buyAmount =
      limit === undefined
        ? amount
        : // calculateCpmmAmountToProb covers the case where the amount doesn't take us down to the limit prob
          Math.min(
            amount,
            calculateCpmmAmountToProb(cpmmState, limit, outcome)
          );

    const { shares, newPool, newP, fees } = calculateCpmmPurchase(
      cpmmState,
      buyAmount,
      outcome
    );
    const newState = { pool: newPool, p: newP };

    return {
      maker: {
        matchedBetId: null,
        shares,
        amount: buyAmount,
        state: newState,
        fees,
        timestamp,
      },
      taker: {
        matchedBetId: null,
        shares,
        amount: buyAmount,
        timestamp,
      },
    };
  }

  // Fill from matchedBet.
  const matchRemaining = matchedBet.orderAmount - matchedBet.amount;
  const shares = Math.min(
    amount /
      (outcome === "YES" ? matchedBet.limitProb : 1 - matchedBet.limitProb),
    matchRemaining /
      (outcome === "YES" ? 1 - matchedBet.limitProb : matchedBet.limitProb)
  );

  const maker = {
    bet: matchedBet,
    matchedBetId: "taker",
    amount:
      shares *
      (outcome === "YES" ? 1 - matchedBet.limitProb : matchedBet.limitProb),
    shares,
    timestamp,
  };
  const taker = {
    matchedBetId: matchedBet.id,
    amount:
      shares *
      (outcome === "YES" ? matchedBet.limitProb : 1 - matchedBet.limitProb),
    shares,
    timestamp,
  };
  return { maker, taker };
};

const addObjects = <K extends string>(
  obj1: Record<K, number>,
  obj2: Record<K, number>
) => {
  const keys = union(Object.keys(obj1), Object.keys(obj2));
  const newObj: Record<K, number> = {} as Record<K, number>;

  for (const key of keys as Array<K>) {
    newObj[key] = (obj1[key] ?? 0) + (obj2[key] ?? 0);
  }

  return newObj;
};

const computeFills = (
  outcome: "YES" | "NO",
  betAmount: number,
  state: CpmmState,
  limitProb: number | undefined,
  unfilledBets: LimitBet[],
  balanceByUserId: { [userId: string]: number }
) => {
  if (isNaN(betAmount)) {
    throw new Error(`Invalid bet amount: ${betAmount}`);
  }
  if (isNaN(limitProb ?? 0)) {
    throw new Error(`Invalid limitProb: ${limitProb}`);
  }

  const sortedBets = sortBy(
    unfilledBets.filter((bet) => bet.outcome !== outcome),
    (bet) => (outcome === "YES" ? bet.limitProb : -bet.limitProb),
    (bet) => bet.createdTime
  );

  const takers: fill[] = [];
  const makers: {
    bet: LimitBet;
    amount: number;
    shares: number;
    timestamp: number;
  }[] = [];
  const ordersToCancel: LimitBet[] = [];

  let amount = betAmount;
  let cpmmState = { pool: state.pool, p: state.p };
  let totalFees = noFees;
  const currentBalanceByUserId = { ...balanceByUserId };

  let i = 0;
  while (true) {
    const matchedBet: LimitBet | undefined = sortedBets[i];
    const fill = computeFill(amount, outcome, limitProb, cpmmState, matchedBet);
    if (!fill) break;

    const { taker, maker } = fill;

    if (maker.matchedBetId === null) {
      // Matched against pool.
      cpmmState = maker.state;
      totalFees = addObjects(totalFees, maker.fees);
      takers.push(taker);
    } else {
      // Matched against bet.
      i++;
      const { userId } = maker.bet;
      const makerBalance = currentBalanceByUserId[userId];

      if (floatingGreaterEqual(makerBalance, maker.amount)) {
        currentBalanceByUserId[userId] = makerBalance - maker.amount;
      } else {
        // Insufficient balance. Cancel maker bet.
        ordersToCancel.push(maker.bet);
        continue;
      }

      takers.push(taker);
      makers.push(maker);
    }

    amount -= taker.amount;

    if (floatingEqual(amount, 0)) break;
  }

  return { takers, makers, totalFees, cpmmState, ordersToCancel };
};

function assertDefined<T>(value: T | undefined): value is T {
  if (value === undefined) {
    throw new Error("Value is undefined");
  }
  return true;
}

export const getBinaryCpmmBetInfo = (
  outcome: "YES" | "NO",
  betAmount: number,
  contract: LiteMarket,
  limitProb: number | undefined,
  unfilledBets: LimitBet[],
  balanceByUserId: { [userId: string]: number }
) => {
  const { pool, p } = contract;
  if (!assertDefined(p)) throw new Error("p is undefined");

  const { takers, makers, cpmmState, totalFees, ordersToCancel } = computeFills(
    outcome,
    betAmount,
    { pool, p },
    limitProb,
    unfilledBets,
    balanceByUserId
  );
  const probBefore = getCpmmProbability(contract.pool, p);
  const probAfter = getCpmmProbability(cpmmState.pool, cpmmState.p);

  const takerAmount = sumBy(takers, "amount");
  const takerShares = sumBy(takers, "shares");
  const isFilled = floatingEqual(betAmount, takerAmount);

  const newBet: CandidateBet = removeUndefinedProps({
    orderAmount: betAmount,
    amount: takerAmount,
    shares: takerShares,
    limitProb,
    isFilled,
    isCancelled: false,
    fills: takers,
    contractId: contract.id,
    outcome,
    probBefore,
    probAfter,
    loanAmount: 0,
    createdTime: Date.now(),
    fees: totalFees,
    isAnte: false,
    isRedemption: false,
    isChallenge: false,
  });

  const { liquidityFee } = totalFees;
  const newTotalLiquidity = (contract.totalLiquidity ?? 0) + liquidityFee;

  return {
    newBet,
    newPool: cpmmState.pool,
    newP: cpmmState.p,
    newTotalLiquidity,
    makers,
    ordersToCancel,
  };
};
