import logger from "@/logger";
import { CpmmMarketModel } from "./market";
import { computePayoutDistribution, integrateOverPmf } from "./probability";
import { UserModel } from "./user";

type NaiveKellyProps = {
  marketProb: number;
  estimatedProb: number;
  deferenceFactor: number;
};

export type Outcome = "YES" | "NO";

export type BetRecommendation = {
  amount: number;
  outcome: Outcome;
  shares: number;
  pAfter: number;
};

export type BetRecommendationFull = BetRecommendation & {
  dailyRoi: number;
  dailyTotalRoi: number;
};

export type AsyncUnivariateFunction = (input: number) => Promise<number>;
export type UnivariateFunction = (input: number) => number;

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
}: NaiveKellyProps & { bankroll: number }): {
  amount: number;
  outcome: Outcome;
} {
  const { fraction, outcome } = calculateNaiveKellyFraction(fractionOnlyProps);
  return {
    amount: bankroll * fraction,
    outcome,
  };
}

/**
 * Differentiate a function numerically
 */
function D(f: UnivariateFunction, x: number, h = 1e-3): number {
  const fPlus = f(x + h);
  const fMinus = f(x - h);

  return (fPlus - fMinus) / (2 * h);
}

/**
 * Solve equation of the form f(x) = 0 using Newton's method
 */
export function findRoot(
  f: UnivariateFunction,
  lowerBound: number,
  upperBound: number,
  iterations = 20,
  tolerance = 1e-6
): number {
  let x = (lowerBound + upperBound) / 2;

  for (let i = 0; i < iterations; i++) {
    const fx = f(x);
    const dfx = D(f, x);

    const incIdeal = dfx !== 0 ? fx / dfx : Math.random();
    // If the increment is very large, it's probably because we're near a stationary point,
    // scale it down to avoid overshooting
    const inc =
      Math.abs(incIdeal) > (upperBound - lowerBound) / 2
        ? incIdeal / 10
        : incIdeal;

    let xNext = x - inc;

    // Check if xNext is within bounds
    if (xNext < lowerBound || xNext > upperBound) {
      // Option 2: Adjust xNext to be at the boundary
      xNext = xNext < lowerBound ? lowerBound : upperBound;
    }

    if (Math.abs(xNext - x) < tolerance) {
      // If the difference between x and xNext is less than the tolerance, we found a solution.
      // logger.debug("Found root solution");
      return xNext;
    }

    x = xNext;
  }

  // If the solution is not found within the given number of iterations, return the last estimate.
  logger.warn("Failed to find root solution");
  return x;
}

/**
 * Calculate the Kelly optimal bet, accounting for:
 *  - market liquidity
 *  - illiquid investments
 *
 * Not yet accounting for:
 *  - illiquid investments completely properly... monte carlo sampling has its limits
 *  - opportunity cost
 *  - loans properly (TODO add an "acceptable risk of ruin" parameter, or otherwise report this)
 */
export function calculateFullKellyBet({
  estimatedProb,
  deferenceFactor,
  marketModel,
  userModel,
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketModel: CpmmMarketModel;
  userModel: UserModel;
}): BetRecommendation {
  const positions = userModel.positions.sort(
    (a, b) => b.probability * b.payout - a.probability * a.payout
  );
  const balance = userModel.balanceAfterLoans;
  const illiquidEV = userModel.illiquidEV;
  const relativeIlliquidEV = illiquidEV / balance;

  logger.debug("Available:", { balance, illiquidEV, relativeIlliquidEV });

  const illiquidPmf = computePayoutDistribution(
    positions,
    positions.length > 12 ? "monte-carlo" : "cartesian"
  );

  logger.debug("Illiquid PMF:", illiquidPmf.size);

  const startingMarketProb = marketModel.market.probability;

  const { amount: naiveKellyAmount, outcome } = calculateNaiveKellyBet({
    marketProb: startingMarketProb,
    estimatedProb,
    deferenceFactor,
    bankroll: balance,
  });

  const pYes =
    estimatedProb * deferenceFactor +
    (1 - deferenceFactor) * startingMarketProb;
  const qYes = 1 - pYes;
  const pWin = outcome === "YES" ? pYes : qYes;
  const qWin = 1 - pWin;

  const englishOdds = (betEstimate: number) => {
    const { newShares } = marketModel.getBetInfo(outcome, betEstimate);
    return (newShares - betEstimate) / betEstimate;
  };

  /**
   * The derivative of the EV of the bet with respect to the bet amount, only considering the
   * user's balance, not other illiquid investments they have. This should give an optimal bet
   * _lower_ than the actual optimum
   */
  const dEVdBetBalanceOnly = (betEstimate: number) => {
    const englishOddsEstimate = englishOdds(betEstimate);
    const englishOddsDerivative = D(englishOdds, betEstimate, 0.1);

    // Af^2 + Bf + C = 0 at optimum for _fraction_ of bankroll f
    const A = pWin * balance * englishOddsDerivative;
    const B = englishOddsEstimate - A;
    const C = -(pWin * englishOddsEstimate - qWin);

    // Using this intermediate root finding is _much_ more numerically stable than finding the
    // root of Af^2 + Bf + C = 0 directly for some reason
    const f = A === 0 ? -C / B : (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);

    const newBetEstimate = f * balance;

    // This is the difference we want to be zero.
    return newBetEstimate - betEstimate;
  };
  /**
   * The derivative of the EV of the bet with respect to the bet amount, considering the
   * user's balance and treating the illiquid investments as if they are a lump of cash
   * equal to their current expected value ("cashed out" is a bit of misnomer here because
   * selling the shares would actually change the market price and so you couldn't recover the
   * full EV). This should give an optimal bet _higher_ than the actual optimum, because we are optimising
   * log wealth, which means scenarios where the illiquid investments don't pay out much hurt the EV more
   * than the other way around.
   */
  const dEVdBetIlliquidCashedOut = (betEstimate: number) => {
    const englishOddsEstimate = englishOdds(betEstimate);
    const englishOddsDerivative = D(englishOdds, betEstimate, 0.1);

    const f = betEstimate / balance;
    const I = relativeIlliquidEV;

    const A = (pWin * englishOddsEstimate) / (1 + I + f * englishOddsEstimate);
    const B = -qWin / (1 + I - f);
    const C =
      (pWin * f * englishOddsDerivative * balance) /
      (1 + I + f * englishOddsEstimate);

    return A + B + C;
  };
  /**
   * The derivative of the EV of the bet with respect to the bet amount, considering the
   * user's balance and modelling the range of outcomes of the illiquid investments. This should
   * give the true optimal bet, and be between the other two values
   */
  const dEVdBet = (betEstimate: number) => {
    const englishOddsEstimate = englishOdds(betEstimate);
    const englishOddsDerivative = D(englishOdds, betEstimate, 0.1);

    const f = betEstimate / balance;

    const integrand = (payout: number) => {
      const I = payout / balance;

      // There is a singularity at 1 + I - f = 0 (i.e. when the user bets their whole balance)
      // treat cases where the user is betting _more_ than their balance as if they are betting
      // extremely close to their balance (essentially apply a large negative penalty).
      // The "/ Math.abs(1 + I - f)" is to hopefully provide directional information to the root
      // solver to improve numerical stability
      const bDenom = 1 + I - f > 0 ? 1 + I - f : 1e-12 / Math.abs(1 + I - f);

      const A =
        (pWin * englishOddsEstimate) / (1 + I + f * englishOddsEstimate);
      const B = -qWin / bDenom;
      const C =
        (pWin * f * englishOddsDerivative * balance) /
        (1 + I + f * englishOddsEstimate);

      return A + B + C;
    };
    const integral = integrateOverPmf(integrand, illiquidPmf);

    return integral;
  };

  const optimalBetBalanceOnly = findRoot(
    dEVdBetBalanceOnly,
    0,
    naiveKellyAmount
  );
  // If the market were perfectly liquid for bets above optimalBetBalanceOnly, and the users illiquid investments
  // had a 100% chance of paying out, this would be the optimal bet
  const upperBound = Math.min(
    optimalBetBalanceOnly * (1 + relativeIlliquidEV),
    0.99 * balance
  );

  const optimalBet = findRoot(dEVdBet, optimalBetBalanceOnly * 0.5, upperBound);
  const optimalBetCashedOut = findRoot(
    dEVdBetIlliquidCashedOut,
    optimalBetBalanceOnly * 0.5,
    upperBound
  );

  logger.debug({
    optimalBetBalanceOnly,
    optimalBet,
    optimalBetCashedOut,
    upperBound,
  });

  // get the shares and pAfter
  const { newShares: shares, probAfter: pAfter } = marketModel.getBetInfo(
    outcome,
    optimalBet
  );

  return {
    amount: optimalBet,
    outcome,
    shares,
    pAfter: pAfter ?? 0,
  };
}

export function getBetRecommendation({
  estimatedProb,
  deferenceFactor,
  marketModel,
  userModel,
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketModel: CpmmMarketModel;
  userModel: UserModel;
}): BetRecommendationFull {
  logger.debug("getBetRecommendation", {
    estimatedProb,
    deferenceFactor,
    marketModel,
    userModel,
  });
  if (!estimatedProb || !deferenceFactor || !marketModel || !userModel) {
    return {
      amount: 0,
      outcome: "YES",
      shares: 0,
      pAfter: 0,
      dailyRoi: 0,
      dailyTotalRoi: 0,
      // TODO add explicited error code
    };
  }

  const { amount, outcome, shares, pAfter } = calculateFullKellyBet({
    estimatedProb,
    deferenceFactor,
    marketModel,
    userModel,
  });

  if (!marketModel.market.closeTime) {
    return {
      amount,
      outcome,
      shares,
      pAfter,
      dailyRoi: 0,
      dailyTotalRoi: 0,
    };
  }

  const timeToCloseYears =
    (marketModel.market.closeTime - Date.now()) / (1000 * 60 * 60 * 24 * 365);

  const adjustedProb =
    estimatedProb * deferenceFactor +
    (1 - deferenceFactor) * marketModel.market.probability;

  const pWin = outcome === "YES" ? adjustedProb : 1 - adjustedProb;
  const EV = pWin * shares;

  // dailyRoi is the answer to the question "Suppose you and 100 of your friends made this bet on independent but otherwise
  // identical markets, and then pooled all your winnings at the end. What would your average daily return be?". In other
  // words, if you are spreading your bets thinly across many markets, then your net daily return will be approximately
  // the average of the dailyRoi of each bet.

  // amount * dailyRoi ^ timeToCloseDays = EV <=> dailyRoi = Math.exp(Math.log(EV / amount) / timeToCloseDays)
  const annualRoi = Math.exp(Math.log(EV / amount) / timeToCloseYears);

  // dailyTotalRoi is the answer to the question "Suppose this is the only bet you make, what is the average daily return
  // relative to your entire bankroll?". In other words, if you are putting all your eggs in one basket, then this will be
  // your net daily return. Note that for a single market dailyTotalRoi is strictly less than dailyRoi.
  //
  // Relatedly, if you find a market with a dailyTotalRoi greater than the dailyRoi of other markets, then you should almost
  // certainly pull money out of the other markets and put it into the first. Because even if you _only_ bet in that market
  // from now on, you will still make more money than you would have if you had kept your money more spread around.
  const totalYesEV = userModel.portfolioEV + shares - amount;
  const totalNoEV = userModel.portfolioEV - amount;

  const logEV = pWin * Math.log(totalYesEV) + (1 - pWin) * Math.log(totalNoEV);
  // logEV = Math.log(portfolioEV * dailyTotalRoi ^ timeToCloseDays) == Math.log(portfolioEV) + timeToCloseDays * Math.log(dailyTotalRoi)
  // => dailyTotalRoi = Math.exp((logEV - Math.log(portfolioEV)) / timeToCloseDays)
  const annualTotalRoi = Math.exp(
    (logEV - Math.log(userModel.portfolioEV)) / timeToCloseYears
  );

  logger.debug({ timeToCloseYears, annualRoi, annualTotalRoi });

  return {
    amount,
    outcome,
    shares,
    pAfter,
    dailyRoi: annualRoi,
    dailyTotalRoi: annualTotalRoi,
  };
}
