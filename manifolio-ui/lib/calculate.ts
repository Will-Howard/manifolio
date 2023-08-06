import logger from "@/logger";
import { CpmmMarketModel } from "./market";
import {
  ManifoldPosition,
  integrateOverPmf,
  mcSampleSize,
} from "./probability";
import { UserModel } from "./user";
import { ManifolioError } from "@/components/ErrorMessage";

type NaiveKellyProps = {
  marketProb: number;
  estimatedProb: number;
  deferenceFactor: number;
};

export type Outcome = "YES" | "NO";

export type BetRecommendation = {
  amount: number;
  outcome: Outcome;
  newShares: number;
  pAfter: number;
  positionAfter: { yesShares: number; noShares: number; cash: number };
};

export type BetRecommendationFull = BetRecommendation & {
  annualRoi: number;
  annualTotalRoi: number;
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
 * Multiply the naive Kelly fraction by the bankroll to get the amount to bet
 *
 * @param marketProb The implied probability of the market
 * @param estimatedProb Your estimated probability of the outcome
 * @param deferenceFactor The deference factor k scales down the fraction to bet. A value of 0.6
 * is equivalent to saying "There is a 60% chance that I'm right, and a 40% chance the market is right"
 * @param bankroll The bankroll amount
 */
export function calculateNaiveKellyBet({
  marketProb,
  estimatedProb,
  deferenceFactor,
  bankroll,
}: NaiveKellyProps & { bankroll: number }): {
  fraction: number;
  amount: number;
  outcome: Outcome;
} {
  const outcome = estimatedProb > marketProb ? "YES" : "NO";
  const marketWinProb = outcome === "YES" ? marketProb : 1 - marketProb;

  // kellyFraction * ((p - p_market) / (1 - p_market))
  const fraction =
    deferenceFactor *
    (Math.abs(estimatedProb - marketProb) / (1 - marketWinProb));
  // clamp fraction between 0 and 1
  const clampedFraction = Math.min(Math.max(fraction, 0), 1);
  const amount = bankroll * clampedFraction;

  return {
    fraction: clampedFraction,
    amount,
    outcome,
  };
}

/**
 * Calculate the result of the naive Kelly formula: f = k * (p - p_market) / (1 - p_market)
 * Multiply the naive Kelly fraction by the bankroll to get the amount to bet
 *
 * @param marketProb The implied probability of the market
 * @param estimatedProb Your estimated probability of the outcome
 * @param deferenceFactor The deference factor k scales down the fraction to bet. A value of 0.6
 * is equivalent to saying "There is a 60% chance that I'm right, and a 40% chance the market is right"
 * @param bankroll The bankroll amount
 */
export function calculateNaiveKellyBetWithPosition({
  marketProb,
  estimatedProb,
  deferenceFactor,
  bankroll,
  position: { yesShares, noShares } = { yesShares: 0, noShares: 0 },
}: NaiveKellyProps & {
  bankroll: number;
  position?: { yesShares: number; noShares: number };
}): {
  fraction: number;
  amount: number;
  outcome: Outcome;
} {
  const deferenceAdjustedProb =
    estimatedProb * deferenceFactor + (1 - deferenceFactor) * marketProb;

  const calculateAssumingOutcome = (outcome: Outcome) => {
    // f = pWin * (1 + lossShares) - (qWin * (1 + winShares)) / b
    // where b is englishOdds, = (1 / marketProb) - 1

    const pWin =
      outcome === "YES" ? deferenceAdjustedProb : 1 - deferenceAdjustedProb;
    const qWin = 1 - pWin;
    const winShares = outcome === "YES" ? yesShares : noShares;
    const lossShares = outcome === "YES" ? noShares : yesShares;
    const marketWinProb = outcome === "YES" ? marketProb : 1 - marketProb;
    const englishOdds = convertOdds({
      from: "impliedProbability",
      to: "englishOdds",
      value: marketWinProb,
    });

    const fraction =
      pWin * (1 + lossShares) - (qWin * (1 + winShares)) / englishOdds;

    return fraction;
  };

  const outcome = estimatedProb > marketProb ? "YES" : "NO";
  let fraction = calculateAssumingOutcome(outcome);
  if (fraction < 0) {
    // If the fraction is negative, then the outcome is wrong, so we should bet the other way
    fraction = calculateAssumingOutcome(outcome === "YES" ? "NO" : "YES");
  }

  // clamp fraction between 0 and 1
  const clampedFraction = Math.min(Math.max(fraction, 0), 1);
  const amount = bankroll * clampedFraction;

  return {
    fraction: clampedFraction,
    amount,
    outcome,
  };
}

/**
 * Differentiate a function numerically
 */
function D(
  f: UnivariateFunction,
  x: number,
  h = 1e-3,
  bounds?: [number, number]
): number {
  // upperBound and lowerBound are x + h, x - h, unless they are outside the bounds
  const upperBound = bounds ? Math.min(x + h, bounds[1]) : x + h;
  const lowerBound = bounds ? Math.max(x - h, bounds[0]) : x - h;

  const fPlus = f(upperBound);
  const fMinus = f(lowerBound);

  return (fPlus - fMinus) / (2 * h);
}

/**
 * Solve equation of the form f(x) = 0 using Newton's method
 */
export function findRoot(
  f: UnivariateFunction,
  lowerBound: number,
  upperBound: number,
  method: "newton" | "binary" = "newton",
  iterations = 30,
  tolerance = 1e-6
): number {
  if (method === "binary") {
    // Below algorithm requires an increasing function
    const comparator = f(upperBound) > f(lowerBound) ? f : (x: number) => -f(x);
    let mid = 0;
    let min = lowerBound;
    let max = upperBound;

    for (let i = 0; i < iterations; i++) {
      mid = min + (max - min) / 2;

      // Break if we hit one of the bounds. Note that it will only get here
      // if it has not reached the required tolerance so it is correct to say it has failed to find a solution
      if (Math.min(Math.abs(mid - min), Math.abs(mid - max)) < tolerance) {
        logger.debug(
          "Failed to find root solution, hit a bound. This is expected when loans are high relative to balance"
        );
        return mid;
      }

      const comparison = comparator(mid);
      if (Math.abs(comparison) < tolerance) {
        logger.debug("Found root solution");
        return mid;
      } else if (comparison > 0) {
        max = mid;
      } else {
        min = mid;
      }
    }

    logger.warn(
      `Failed to find root solution, remaining error: ${comparator(mid)}`
    );
    return mid;
  }

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
      logger.debug("Found root solution");
      return xNext;
    }

    x = xNext;
  }

  // If the solution is not found within the given number of iterations, return the last estimate.
  logger.warn(`Failed to find root solution, remaining error: ${f(x)}`);
  return x;
}

/**
 * Get the market probability to defer to, calculated as the probability after the user
 * sells off their current position
 */
const getMarketDeferralProb = (
  currentPosition: ManifoldPosition | undefined,
  marketModel: CpmmMarketModel,
  balanceAfterLoans: number
) => {
  const currentMarketProb = marketModel.market.probability;
  if (!currentPosition) {
    return currentMarketProb;
  }

  const currentShares = currentPosition.payout;
  const oppositeOutcome = currentPosition.outcome === "YES" ? "NO" : "YES";

  const getNetSharesForAmount = (amount: number) => {
    const { newShares } = marketModel.getBetInfo(oppositeOutcome, amount);
    return newShares - currentShares;
  };

  const neutralBetAmount = findRoot(
    getNetSharesForAmount,
    0,
    balanceAfterLoans,
    "newton"
  );

  const { newShares, probAfter } = marketModel.getBetInfo(
    oppositeOutcome,
    neutralBetAmount
  );

  logger.debug("Market deferral bet", {
    neutralBetAmount,
    newShares,
    probAfter,
  });
  return probAfter ?? currentMarketProb;
};

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
  pushError = () => {},
  clearError = () => {},
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketModel: CpmmMarketModel;
  userModel: UserModel;
  pushError?: (error: ManifolioError) => void;
  clearError?: (key: string) => void;
}): BetRecommendation & {
  logWealthGain: number;
  wealthGain: number;
} {
  const currentPosition = userModel.getPosition(marketModel.market.id);

  const yesShares =
    currentPosition?.outcome === "YES" ? currentPosition.payout : 0;
  const noShares =
    currentPosition?.outcome === "NO" ? currentPosition.payout : 0;

  const balance = userModel.balance;

  // YES and NO shares relative to the balance after loans
  const sYes = yesShares / balance;
  const sNo = noShares / balance;

  const illiquidPmf = userModel.getIlliquidPmf(currentPosition?.contractId);

  logger.debug("Illiquid PMF size:", illiquidPmf.size);

  const marketDeferralProb = getMarketDeferralProb(
    currentPosition,
    marketModel,
    balance
  );

  const pYes =
    estimatedProb * deferenceFactor +
    (1 - deferenceFactor) * marketDeferralProb;
  const qYes = 1 - pYes;

  const currentPositionEV =
    (currentPosition?.payout ?? 0) * (currentPosition?.probability ?? 0);
  const illiquidEV = userModel.illiquidEV - currentPositionEV;

  const relativeIlliquidEV = illiquidEV / balance;
  const relativeLoans = userModel.loans / balance;

  const pmfEV = integrateOverPmf((payout) => payout, illiquidPmf);

  logger.debug("Available:", {
    balance,
    balanceAfterLoans: balance - userModel.loans,
    illiquidEV,
    pmfEV,
    relativeIlliquidEV,
    relativeLoans,
  });

  const englishOdds = (absBetEstimate: number, betOutcome: Outcome) => {
    const { newShares } = marketModel.getBetInfo(betOutcome, absBetEstimate);
    return (newShares - absBetEstimate) / absBetEstimate;
  };

  /**
   * The derivative of the EV of the bet with respect to the bet amount, treating the bankroll
   * as fixed (i.e. not considering the variation in outcome of the user's other positions). This is
   * use below to calculate upper and lower bounds on the optimal bet before doing a more expensive
   * integration
   */
  const dEVdBetFixedBankroll = (
    betEstimate: number,
    effectiveRelativeIlliquidEV: number
  ) => {
    // Bad things happen if the bet estimate is exactly 0
    if (betEstimate === 0) {
      betEstimate = 1e-3;
    }

    const relativeBetEstimate = betEstimate / balance;

    const fYes = Math.max(relativeBetEstimate, 0);
    const fNo = Math.max(-relativeBetEstimate, 0);

    const dfYesdf = betEstimate > 0 ? 1 : 0;
    const dfNodf = betEstimate < 0 ? -1 : 0;

    const absBetEstimate = Math.abs(betEstimate);

    const bYes = fYes && englishOdds(absBetEstimate, "YES");
    const dbYesdBetYes =
      fYes && D((x: number) => englishOdds(x, "YES"), absBetEstimate, 0.1);
    const bNo = fNo && englishOdds(absBetEstimate, "NO");
    const dbNodBetNo =
      fNo && D((x: number) => englishOdds(x, "NO"), absBetEstimate, 0.1);

    const I = effectiveRelativeIlliquidEV;

    if (
      Math.min(
        1 + I + sYes + fYes * bYes - fNo,
        1 + I + sNo + fNo * bNo - fYes
      ) < 0
    ) {
      throw new Error(
        "Net worth is negative in calculation, something has gone horribly wrong"
      );
    }

    // EV = p ln(1 + I + sYes + fYes * bYes - fNo) + q ln(1 + I + sNo + fNo * bNo - fYes)
    const A = dfYesdf * ((pYes * bYes) / (1 + I + sYes + fYes * bYes - fNo));
    const B = dfNodf * (-pYes / (1 + I + sYes + fYes * bYes - fNo));

    const C = dfNodf * ((qYes * bNo) / (1 + I + sNo + fNo * bNo - fYes));
    // D is taken
    const E = dfYesdf * (-qYes / (1 + I + sNo + fNo * bNo - fYes));

    const F =
      dfYesdf *
      ((pYes * fYes * dbYesdBetYes * balance) /
        (1 + I + sYes + fYes * bYes - fNo));
    const G =
      dfNodf *
      ((qYes * fNo * dbNodBetNo * balance) / (1 + I + sNo + fNo * bNo - fYes));

    const result = A + B + C + E + F + G;
    return result;
  };

  /**
   * The derivative of the EV of the bet with respect to the bet amount, only considering the
   * user's balance (minus loans they will have to pay back), not other illiquid investments they have.
   * This should give an optimal bet _lower_ than the actual optimum
   */
  const dEVdBetBalanceOnly = (betEstimate: number) =>
    dEVdBetFixedBankroll(betEstimate, -relativeLoans);

  /**
   * The derivative of the EV of the bet with respect to the bet amount, considering the
   * user's balance and treating the illiquid investments as if they are a lump of cash
   * equal to their current expected value ("cashed out" is a bit of malappropism here because
   * selling the shares would actually change the market price and so you couldn't recover the
   * full EV). This should give an optimal bet _higher_ than the actual optimum, because we are optimising
   * log wealth, which means scenarios where the illiquid investments don't pay out much hurt the EV more
   * than the other way around.
   */
  const dEVdBetIlliquidCashedOut = (betEstimate: number) =>
    dEVdBetFixedBankroll(betEstimate, relativeIlliquidEV - relativeLoans);

  /**
   * The derivative of the EV of the bet with respect to the bet amount, considering the
   * user's balance and modelling the range of outcomes of the illiquid investments. This should
   * give the true optimal bet, and be between the other two values
   */
  const dEVdBet = (betEstimate: number) => {
    // Bad things happen if the bet estimate is exactly 0
    if (betEstimate === 0) {
      betEstimate = 1e-3;
    }

    const relativeBetEstimate = betEstimate / balance;

    const fYes = Math.max(relativeBetEstimate, 0);
    const fNo = Math.max(-relativeBetEstimate, 0);

    const dfYesdf = betEstimate > 0 ? 1 : 0;
    const dfNodf = betEstimate < 0 ? -1 : 0;

    const absBetEstimate = Math.abs(betEstimate);

    const bYes = fYes && englishOdds(absBetEstimate, "YES");
    const dbYesdBetYes =
      fYes && D((x: number) => englishOdds(x, "YES"), absBetEstimate, 0.1);
    const bNo = fNo && englishOdds(absBetEstimate, "NO");
    const dbNodBetNo =
      fNo && D((x: number) => englishOdds(x, "NO"), absBetEstimate, 0.1);

    const integrand = (payout: number) => {
      const I = payout / balance - relativeLoans;

      if (
        Math.min(
          1 + I + sYes + fYes * bYes - fNo,
          1 + I + sNo + fNo * bNo - fYes
        ) < 0
      ) {
        throw new Error(
          "Net worth is negative in calculation, something has gone horribly wrong"
        );
      }

      // EV = p ln(1 + I + sYes + fYes * bYes - fNo) + q ln(1 + I + sNo + fNo * bNo - fYes)
      const A = dfYesdf * ((pYes * bYes) / (1 + I + sYes + fYes * bYes - fNo));
      const B = dfNodf * (-pYes / (1 + I + sYes + fYes * bYes - fNo));

      const C = dfNodf * ((qYes * bNo) / (1 + I + sNo + fNo * bNo - fYes));
      // D is taken
      const E = dfYesdf * (-qYes / (1 + I + sNo + fNo * bNo - fYes));

      const F =
        dfYesdf *
        ((pYes * fYes * dbYesdBetYes * balance) /
          (1 + I + sYes + fYes * bYes - fNo));
      const G =
        dfNodf *
        ((qYes * fNo * dbNodBetNo * balance) /
          (1 + I + sNo + fNo * bNo - fYes));

      const result = A + B + C + E + F + G;
      return result;
    };

    const integral = integrateOverPmf(integrand, illiquidPmf);

    return integral;
  };

  /**
   * The actual log ev
   */
  const logEV = (betEstimate: number) => {
    // Bad things happen if the bet estimate is exactly 0
    if (betEstimate === 0) {
      betEstimate = 1e-3;
    }

    const relativeBetEstimate = betEstimate / balance;

    const fYes = Math.max(relativeBetEstimate, 0);
    const fNo = Math.max(-relativeBetEstimate, 0);

    const absBetEstimate = Math.abs(betEstimate);

    const bYes = fYes && englishOdds(absBetEstimate, "YES");
    const bNo = fNo && englishOdds(absBetEstimate, "NO");

    const integrand = (payout: number) => {
      const I = payout / balance - relativeLoans;

      if (
        Math.min(
          1 + I + sYes + fYes * bYes - fNo,
          1 + I + sNo + fNo * bNo - fYes
        ) < 0
      ) {
        throw new Error(
          "Net worth is negative in calculation, something has gone horribly wrong"
        );
      }

      // EV = p ln(1 + I + sYes + fYes * bYes - fNo) + q ln(1 + I + sNo + fNo * bNo - fYes)
      const A = Math.log(1 + I + sYes + fYes * bYes - fNo);
      const B = Math.log(1 + I + sNo + fNo * bNo - fYes);

      const result = pYes * A + qYes * B;
      return result;
    };

    const integral = integrateOverPmf(integrand, illiquidPmf);

    // Add the log of the balance to the integral to make this absolute rather than relative
    return integral + Math.log(balance);
  };

  /**
   * The actual non-log ev
   */
  const EV = (betEstimate: number) => {
    // Bad things happen if the bet estimate is exactly 0
    if (betEstimate === 0) {
      betEstimate = 1e-3;
    }

    const relativeBetEstimate = betEstimate / balance;

    const fYes = Math.max(relativeBetEstimate, 0);
    const fNo = Math.max(-relativeBetEstimate, 0);

    const absBetEstimate = Math.abs(betEstimate);

    const bYes = fYes && englishOdds(absBetEstimate, "YES");
    const bNo = fNo && englishOdds(absBetEstimate, "NO");

    const integrand = (payout: number) => {
      const I = payout / balance - relativeLoans;

      if (
        Math.min(
          1 + I + sYes + fYes * bYes - fNo,
          1 + I + sNo + fNo * bNo - fYes
        ) < 0
      ) {
        throw new Error(
          "Net worth is negative in calculation, something has gone horribly wrong"
        );
      }

      // EV = p ln(1 + I + sYes + fYes * bYes - fNo) + q ln(1 + I + sNo + fNo * bNo - fYes)
      const A = 1 + I + sYes + fYes * bYes - fNo;
      const B = 1 + I + sNo + fNo * bNo - fYes;

      const result = pYes * A + qYes * B;
      return result;
    };

    const integral = integrateOverPmf(integrand, illiquidPmf);

    return integral * balance;
  };

  const balanceOnlyBound = (balance - userModel.loans) * 0.99;
  const absoluteBound = Math.min(
    balanceOnlyBound + Math.min(...illiquidPmf.keys()) * 0.99,
    balance * 0.99
  );
  const cashedOutBound = balanceOnlyBound + illiquidEV * 0.99;

  const balanceBoundNonPositive = balanceOnlyBound <= 0;
  const absoluteBoundNonPositive = absoluteBound <= 0;

  if (balanceBoundNonPositive) {
    pushError({
      key: "ruinWarning",
      message:
        "You have total loans greater than your current balance. Under strict Kelly betting, " +
        "you should not bet at all in this scenario because there is non-zero risk of ruin. " +
        "This calculator allows some leeway in this, and will still recommend a bet as long as losing " +
        `all your money does not actually occur in any of the (up to ${mcSampleSize.toLocaleString()}) scenarios it simulates.`,
      severity: "warning",
    });
  }

  if (absoluteBoundNonPositive) {
    const pRuin = integrateOverPmf((payout) => {
      const I = payout * 0.99 + balanceOnlyBound;
      return I <= 0 ? 1 : 0;
    }, illiquidPmf);

    pushError({
      key: "ruinWarning",
      message:
        "You have a non-trivial risk of ruin with your current portfolio, so this caculator will recommend " +
        `that you should not bet at all. Under strict Kelly betting, if you have total loans greater than ` +
        "your balance then there is a non-zero chance of losing all your money, so you shouldn't bet. " +
        "This calculator allows some leeway in this, and will still recommend a bet as long as losing " +
        `all your money does not actually occur in any of the (up to ${mcSampleSize.toLocaleString()}) scenarios it simulates. ` +
        `In this case this did occur in ${
          pRuin * 100
        }% of scenarios, so the recommended bet is 0. You may be able to bring down this risk by selling large ` +
        "positions that you have held for a long time (which will have accumulated a lot of loans).",
      severity: "warning",
    });
    throw new Error("Absolute bound is negative");
  }

  if (!balanceBoundNonPositive) {
    clearError("ruinWarning");
  }

  const optimalBetBalanceOnly =
    balanceOnlyBound > 0
      ? findRoot(
          dEVdBetBalanceOnly,
          -balanceOnlyBound,
          balanceOnlyBound,
          "binary"
        )
      : 0;

  const optimalBetCashedOut =
    cashedOutBound > 0
      ? findRoot(
          dEVdBetIlliquidCashedOut,
          -cashedOutBound,
          cashedOutBound,
          "binary"
        )
      : 0;

  const bounds = [optimalBetBalanceOnly, optimalBetCashedOut].sort(
    // The default implementation of sort is by increasing _absolute_ value (insane decision),
    // we want just increasing value
    (a, b) => a - b
  );
  const optimalBet = findRoot(
    dEVdBet,
    Math.max(bounds[0], -absoluteBound),
    Math.min(bounds[1], absoluteBound),
    "binary"
  );

  const optimalBetAmount = Math.abs(optimalBet);
  const optimalOutcome = optimalBet > 0 ? "YES" : "NO";

  // get the shares and pAfter
  const { newShares: shares, probAfter: pAfter } = marketModel.getBetInfo(
    optimalOutcome,
    optimalBetAmount
  );

  // Calculate positionAfter
  // 1 NO share cancels out with 1 YES share to produce M1
  const naiveYesShares = yesShares + (optimalOutcome === "YES" ? shares : 0);
  const naiveNoShares = noShares + (optimalOutcome === "NO" ? shares : 0);
  const netYesShares = Math.max(naiveYesShares - naiveNoShares, 0);
  const netNoShares = Math.max(naiveNoShares - naiveYesShares, 0);
  const netCash = Math.min(naiveNoShares, naiveYesShares);
  const positionAfter = {
    yesShares: netYesShares,
    noShares: netNoShares,
    cash: netCash,
  };

  // Calculate the gain in expected log wealth
  const logWealthBefore = logEV(0);
  const logWealthAfter = logEV(optimalBet);
  const logWealthGain = logWealthAfter - logWealthBefore;

  // Calculate the gain in expected wealth
  const wealthBefore = EV(0);
  const wealthAfter = EV(optimalBet);
  const wealthGain = wealthAfter - wealthBefore;

  logger.debug({
    optimalBetBalanceOnly,
    optimalBet,
    optimalBetCashedOut,
    positionAfter,
    logWealthGain,
    wealthGain,
  });

  return {
    amount: optimalBetAmount,
    outcome: optimalOutcome,
    newShares: shares,
    pAfter: pAfter ?? 0,
    positionAfter,
    marketDeferralProb,
    logWealthGain,
    wealthGain,
  };
}

function getBetRecommendationInner({
  estimatedProb,
  deferenceFactor,
  marketModel,
  userModel,
  pushError = () => {},
  clearError = () => {},
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketModel: CpmmMarketModel;
  userModel: UserModel;
  pushError?: (error: ManifolioError) => void;
  clearError?: (key: string) => void;
}): BetRecommendationFull {
  const {
    amount,
    outcome,
    newShares,
    pAfter,
    positionAfter,
    logWealthGain,
    wealthGain,
  } = calculateFullKellyBet({
    estimatedProb,
    deferenceFactor,
    marketModel,
    userModel,
    pushError,
    clearError,
  });

  if (!marketModel.market.closeTime) {
    return {
      amount,
      outcome,
      newShares,
      pAfter,
      positionAfter,
      annualRoi: 1,
      annualTotalRoi: 1,
    };
  }

  const timeToCloseYears =
    (marketModel.market.closeTime - Date.now()) / (1000 * 60 * 60 * 24 * 365);

  // annualRoi is the answer to the question "Suppose you found 1000 bets like this one and spread your money across
  // them, what would your expected return be?". If you are spreading your bets thinly across many markets, then your net gain
  // in expected log wealth will be approximately the log of your expected (fractional) gain in wealth, because
  // any variation will average out
  //
  // amount + wealthGain = amount * annualRoi ^ timeToCloseYears
  // => annualRoi = exp(ln((amount + wealthGain) / amount) / timeToCloseYears)
  const annualRoiNew = Math.exp(
    Math.log((amount + wealthGain) / amount) / timeToCloseYears
  );

  // annualTotalRoi is the answer to the question "Suppose this is the only bet you make, what is the average annual return
  // relative to your entire bankroll?". In other words, if you are putting all your eggs in one basket, then this will be
  // your net annual return. Note that for a single market annualTotalRoi is strictly less than annualRoi.
  //
  // Relatedly, if you find a market with an annualTotalRoi greater than the annualRoi of other markets, then you should almost
  // certainly pull money out of the other markets and put it into the first. Because even if you _only_ bet in that market
  // from now on, you will still make more money than you would have if you had kept your money more spread around.
  //
  // logWealthGain = ln(wealthFinal / wealthInitial)
  // wealthFinal = wealthInitial * annualTotalRoi ^ timeToCloseYears
  // => logWealthGain = ln(annualTotalRoi ^ timeToCloseYears)
  // => annualTotalRoi = exp(logWealthGain / timeToCloseYears)
  const annualTotalRoiNew = Math.exp(logWealthGain / timeToCloseYears);

  logger.debug({
    timeToCloseYears,
    annualRoiNew,
    annualTotalRoiNew,
  });

  return {
    amount,
    outcome,
    newShares: newShares,
    pAfter,
    positionAfter,
    annualRoi: amount < 1 ? 1 : annualRoiNew,
    annualTotalRoi: amount < 1 ? 1 : annualTotalRoiNew,
  };
}

export function getBetRecommendation({
  estimatedProb,
  deferenceFactor,
  marketModel,
  userModel,
  pushError = () => {},
  clearError = () => {},
}: {
  estimatedProb: number;
  deferenceFactor: number;
  marketModel: CpmmMarketModel;
  userModel: UserModel;
  pushError?: (error: ManifolioError) => void;
  clearError?: (key: string) => void;
}): BetRecommendationFull {
  const errorFallback = {
    amount: 0,
    outcome: "YES",
    newShares: 0,
    pAfter: 0,
    annualRoi: 1,
    annualTotalRoi: 1,
    positionAfter: { yesShares: 0, noShares: 0, cash: 0 },
  } as const;

  if (
    [estimatedProb, deferenceFactor, marketModel, userModel].some((v) =>
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      [null, undefined].includes(v)
    )
  ) {
    return errorFallback;
  }

  try {
    return getBetRecommendationInner({
      estimatedProb,
      deferenceFactor,
      marketModel,
      userModel,
      pushError,
      clearError,
    });
  } catch (e) {
    logger.error(e);
    return errorFallback;
  }
}
