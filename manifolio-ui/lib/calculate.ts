import { getBinaryCpmmBetInfoWrapper, getMarketProb } from "./market-utils";

type NaiveKellyProps = {
  marketProb: number;
  estimatedProb: number;
  deferenceFactor: number;
};

export type BetRecommendation = {
  amount: number;
  outcome: "YES" | "NO";
};

export function calculateNaiveKellyFraction({
  marketProb,
  estimatedProb,
  deferenceFactor,
}: NaiveKellyProps): { fraction: number; outcome: "YES" | "NO" } {
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

export function getEffectiveProbability({
  outcomeShares,
  betAmount,
  outcome,
}: {
  outcomeShares: number;
  betAmount: number;
  outcome: "YES" | "NO";
}) {
  return outcome === "YES"
    ? betAmount / outcomeShares
    : 1 - betAmount / outcomeShares;
}

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
  const startingMarketProb = await getMarketProb(marketSlug);
  if (!startingMarketProb) {
    console.log("Could not get market prob");
    return { amount: 0, outcome: "YES", shares: 0, pAfter: 0 };
  }
  const { amount: naiveKellyAmount, outcome } = calculateNaiveKellyBet({
    marketProb: startingMarketProb,
    estimatedProb,
    deferenceFactor,
    bankroll,
  });

  let lowerBound = 0;
  let upperBound = naiveKellyAmount;

  let shares = 0;
  let pAfter = 0;
  const iterations = 10;

  for (let i = 0; i < iterations; i++) {
    const betEstimate = (lowerBound + upperBound) / 2;
    const { newShares, probAfter } = await getBinaryCpmmBetInfoWrapper(
      outcome,
      betEstimate,
      marketSlug
    );
    if (!newShares) {
      console.log("Could not get new shares");
      break;
    }

    // This is the actual market probability we are betting at, accounting for liquidity
    const effectiveProb = getEffectiveProbability({
      outcomeShares: newShares,
      betAmount: betEstimate,
      outcome,
    });

    // Calculate the actual kelly optimal bet, given the effective probability
    const { amount: amountGivenProb, outcome: outcomeGivenProb } =
      calculateNaiveKellyBet({
        marketProb: effectiveProb, // FIXME there is some bug where probAfter goes over the estimatedProb
        estimatedProb,
        deferenceFactor,
        bankroll,
      });
    // amount -> -amount if the outcome is different (i.e. we have bet the market past our actual estimate)
    const amountGivenProbAdjusted =
      amountGivenProb * (outcome === outcomeGivenProb ? 1 : -1);

    // If the actual kelly optimal bet at this prob is greater than our estimate, then we are too low, and vice verse
    if (amountGivenProbAdjusted > betEstimate) {
      lowerBound = betEstimate;
    } else {
      upperBound = betEstimate;
    }
    shares = newShares;
    pAfter = probAfter ?? pAfter;
  }

  // At the end of the binary search iterations, the optimal amount to bet is the average of lowerBound and upperBound.
  const optimalAmountToBet = (lowerBound + upperBound) / 2;

  return {
    amount: optimalAmountToBet,
    outcome,
    shares,
    pAfter,
  };
}

// reimplement in general equation solver
type FunctionType = (input: number) => Promise<number>;

async function solveEquation(
  f: FunctionType,
  lowerBound: number,
  upperBound: number,
  iterations = 20,
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

export async function calculateFullKellyBetGeneric({
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
  const startingMarketProb = await getMarketProb(marketSlug);
  if (!startingMarketProb) {
    console.log("Could not get market prob");
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

  const f = async (betEstimate: number) => {
    const { newShares } = await getBinaryCpmmBetInfoWrapper(
      outcome,
      betEstimate,
      marketSlug
    );
    if (!newShares) {
      console.error("Could not get new shares");
      return 0;
    }

    // This is the actual market probability we are betting at, accounting for liquidity
    const effectiveProb = getEffectiveProbability({
      outcomeShares: newShares,
      betAmount: betEstimate,
      outcome,
    });

    // Calculate the actual kelly optimal bet, given the effective probability
    const { amount: amountGivenProb, outcome: outcomeGivenProb } =
      calculateNaiveKellyBet({
        marketProb: effectiveProb, // FIXME there is some bug where probAfter goes over the estimatedProb
        estimatedProb,
        deferenceFactor,
        bankroll,
      });
    // amount -> -amount if the outcome is different (i.e. we have bet the market past our actual estimate)
    const amountGivenProbAdjusted =
      amountGivenProb * (outcome === outcomeGivenProb ? 1 : -1);

    return amountGivenProbAdjusted;
  };

  const optimalBet = await solveEquation(f, lowerBound, upperBound);
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
