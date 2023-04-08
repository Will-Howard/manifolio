import logger from "@/logger";
import { getBinaryCpmmBetInfoWrapper, getMarket } from "./market-utils";

type NaiveKellyProps = {
  marketProb: number;
  estimatedProb: number;
  deferenceFactor: number;
};

export type Outcome = "YES" | "NO";
export type BetRecommendation = {
  amount: number;
  outcome: Outcome;
};

export type BetRecommendationFull = BetRecommendation & {
  shares: number;
  pAfter: number;
};

type OddsType = "decimalOdds" | "englishOdds" | "impliedProbability";

/**
 * Convert between different formulations of betting odds, which are each useful for neatly
 * formulating different equations
 *
 * The three types of odds are:
 * - "decimalOdds": the normal odds you see in most places, e.g. decimal odds of 2.5 means
 * you get 2.5x your stake back INCLUDING your stake
 * - "englishOdds": decimal odds minus 1, e.g. english odds of 2.5 means you get 2.5x your
 * stake back PLUS your stake (so 3.5x in total)
 * - "impliedProbability": the probability implied by the odds
 */
export function convertOdds({
  from,
  to,
  value,
}: {
  from: OddsType;
  to: OddsType;
  value: number;
}) {
  if (from === to) {
    return value;
  }

  const decimalOdds = (() => {
    switch (from) {
      case "decimalOdds":
        return value;
      case "englishOdds":
        return value + 1;
      case "impliedProbability":
        return 1 / value;
      default:
        throw new Error(`Invalid 'from' value: ${from}`);
    }
  })();

  return (() => {
    switch (to) {
      case "decimalOdds":
        return decimalOdds;
      case "englishOdds":
        return decimalOdds - 1;
      case "impliedProbability":
        return 1 / decimalOdds;
      default:
        throw new Error(`Invalid 'to' value: ${to}`);
    }
  })();
}

/**
 * Calculate the result of the naive Kelly formula: f = k * (p - p_market) / (1 - p_market)
 *
 * @param marketProb The implied probability of the market
 * @param estimatedProb Your estimated probability of the outcome
 * @param deferenceFactor The deference factor k scales down the fraction to bet. A value of 0.5
 * is equivalent to saying "There is a 50% chance that I'm right, and a 50% chance the market is right"
 */
export function calculateNaiveKellyFraction({
  marketProb,
  estimatedProb,
  deferenceFactor,
}: NaiveKellyProps): { fraction: number; outcome: Outcome } {
  const outcome = estimatedProb > marketProb ? "YES" : "NO";
  // kellyFraction * ((p - p_market) / (1 - p_market))
  const fraction =
    deferenceFactor * (Math.abs(estimatedProb - marketProb) / (1 - marketProb));
  // clamp fraction between 0 and 1
  const clampedFraction = Math.min(Math.max(fraction, 0), 1);

  return {
    fraction: clampedFraction,
    outcome,
  };
}

/**
 * Multiply the naive Kelly fraction by the bankroll to get the amount to bet
 */
export function calculateNaiveKellyBet({
  bankroll,
  ...fractionOnlyProps
}: NaiveKellyProps & { bankroll: number }): BetRecommendation {
  const { fraction, outcome } = calculateNaiveKellyFraction(fractionOnlyProps);
  return {
    amount: bankroll * fraction,
    outcome,
  };
}

/**
 * Gives the "average probability" you are betting at. This quantity is actually not that
 * meaningful mathematically
 */
export function getEffectiveProbability({
  outcomeShares,
  betAmount,
  outcome,
}: {
  outcomeShares: number;
  betAmount: number;
  outcome: Outcome;
}) {
  return outcome === "YES"
    ? betAmount / outcomeShares
    : 1 - betAmount / outcomeShares;
}

type FunctionType = (input: number) => Promise<number>;

/**
 * Differentiate a function numerically
 */
async function D(f: FunctionType, x: number, h = 1e-6): Promise<number> {
  const fPlus = await f(x + h);
  const fMinus = await f(x - h);

  return (fPlus - fMinus) / (2 * h);
}

/**
 * Solve equation of the form f(x) = x
 */
async function solveEquation(
  f: FunctionType,
  lowerBound: number,
  upperBound: number,
  iterations = 10,
  tolerance = 1e-6
): Promise<number> {
  for (let i = 0; i < iterations; i++) {
    const mid = (lowerBound + upperBound) / 2;
    const fMid = await f(mid);

    if (Math.abs(mid - fMid) < tolerance) {
      // If the difference between mid and f(mid) is less than the tolerance, we found a solution.
      return mid;
    }

    if (fMid > mid) {
      lowerBound = mid;
    } else {
      upperBound = mid;
    }
  }

  // If the solution is not found within the given number of iterations, return the average of the final bounds.
  return (lowerBound + upperBound) / 2;
}

/**
 * Calculate the Kelly optimal bet, accounting for market liquidity. Assume a fixed bankroll
 * and a portfolio of only one bet
 */
export async function calculateFullKellyBet({
  estimatedProb,
  deferenceFactor,
  marketSlug,
  bankroll,
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketSlug: string;
  bankroll: number;
}): Promise<BetRecommendation & { shares: number; pAfter: number }> {
  const market = await getMarket({ slug: marketSlug });
  const startingMarketProb = (await market.getMarket())?.probability;
  if (!startingMarketProb) {
    logger.info("Could not get market prob");
    return { amount: 0, outcome: "YES", shares: 0, pAfter: 0 };
  }
  const { amount: naiveKellyAmount, outcome } = calculateNaiveKellyBet({
    marketProb: startingMarketProb,
    estimatedProb,
    deferenceFactor,
    bankroll,
  });

  const lowerBound = 0;
  const upperBound = naiveKellyAmount;

  const englishOdds = async (betEstimate: number) => {
    const { newShares } = await getBinaryCpmmBetInfoWrapper(
      outcome,
      betEstimate,
      marketSlug
    );
    return (newShares - betEstimate) / betEstimate;
  };
  const calcBetEstimate = async (betEstimate: number) => {
    const englishOddsEstimate = await englishOdds(betEstimate);
    const englishOddsDerivative = await D(englishOdds, betEstimate, 0.1);

    const pYes =
      estimatedProb * deferenceFactor +
      (1 - deferenceFactor) * startingMarketProb;
    const qYes = 1 - pYes;
    const pWin = outcome === "YES" ? pYes : qYes;
    const qWin = 1 - pWin;

    // solve equation Af^2 + Bf + C = 0 for _fraction_ f
    const A = pWin * bankroll * englishOddsDerivative; // does seem to give the right answer
    const B = englishOddsEstimate - A;
    const C = -(pWin * englishOddsEstimate - qWin);
    // solve, handling case where A = 0 separately
    const f = A === 0 ? -C / B : (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);

    const newBetEstimate = f * bankroll;
    return newBetEstimate;
  };

  const optimalBet = await solveEquation(
    calcBetEstimate,
    lowerBound,
    upperBound
  );
  // get the shares and pAfter
  const { newShares: shares, probAfter: pAfter } =
    await getBinaryCpmmBetInfoWrapper(outcome, optimalBet, marketSlug);

  return {
    amount: optimalBet,
    outcome,
    shares,
    pAfter: pAfter ?? 0,
  };
}
