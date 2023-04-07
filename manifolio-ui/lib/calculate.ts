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

export type BetRecommendationFull = BetRecommendation & {
  shares: number;
  pAfter: number;
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

async function D(f: FunctionType, x: number, h = 1e-6): Promise<number> {
  const fPlus = await f(x + h);
  const fMinus = await f(x - h);

  return (fPlus - fMinus) / (2 * h);
}

async function solveEquation(
  f: FunctionType,
  lowerBound: number,
  upperBound: number,
  iterations = 10,
  tolerance = 1e-6
): Promise<number> {
  for (let i = 0; i < iterations; i++) {
    const mid = (lowerBound + upperBound) / 2;
    console.log(
      "Iteration: ",
      i,
      "Mid: ",
      mid,
      "Lower: ",
      lowerBound,
      "Upper: ",
      upperBound,
      ""
    );
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

  const englishOdds = async (betEstimate: number) => {
    const { newShares } = await getBinaryCpmmBetInfoWrapper(
      outcome,
      betEstimate,
      marketSlug
    );
    if (!newShares) {
      throw new Error("Could not get new shares");
    }
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
    // log everything on one line
    console.log(
      "betEstimate",
      betEstimate,
      "englishOddsEstimate",
      englishOddsEstimate,
      "englishOddsDerivative",
      englishOddsDerivative,
      "p",
      pYes,
      "q",
      qYes,
      "A",
      A,
      "B",
      B,
      "C",
      C,
      "outcome",
      outcome,
      "newBetEstimate",
      newBetEstimate
    );
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
