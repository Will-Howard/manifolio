import seedrandom from "seedrandom";
import { Outcome, UnivariateFunction } from "./calculate";

const mcSampleSize = process.env.NEXT_PUBLIC_SAMPLE_SIZE
  ? parseInt(process.env.NEXT_PUBLIC_SAMPLE_SIZE)
  : 50_000;

/**
 * A probability mass function is a mapping from a payout to the probability of that payout.
 */
export type PMF = Map<number, number>;

/**
 * A cumulative distribution function is a mapping from a payout to the probability of that payout or _less_.
 * For instance, if the CDF is { 0: 0.35, 2: 0.5, 3: 0.85, 5: 1 }, then the probability of getting a payout of 2.5 or less is 0.5.
 */
export type CDF = Map<number, number>;

export type PositionModel = {
  probability: number;
  payout: number;
  loan?: number;
};

export type ManifoldPosition = PositionModel & {
  contractId: string;
  outcome?: Outcome;
  // This type corresponds to the types of markets you can filter by in https://manifold.markets/questions
  // , which tend to correspond to a combination of market.mechanism and market.outcomeType (although I'm not
  // 100% sure I've covered all the cases)
  type:
    | "BINARY"
    | "MULTIPLE_CHOICE"
    | "FREE_RESPONSE"
    | "NUMERIC"
    | "BOUNTY"
    | "STOCK";
};

/**
 * Calculate the convolution of two probability mass functions. This is equivalent to
 * finding the pmf of the sum of two random variables (sampled from each distribution).
 */
// function convolveDistributions(pmf1: PMF, pmf2: PMF): PMF {
//   const result = new Map<number, number>();

//   for (const [payout1, prob1] of Array.from(pmf1.entries())) {
//     for (const [payout2, prob2] of Array.from(pmf2.entries())) {
//       const combinedPayout = payout1 + payout2;
//       const combinedProb = prob1 * prob2;

//       result.set(
//         combinedPayout,
//         (result.get(combinedPayout) || 0) + combinedProb
//       );
//     }
//   }

//   return result;
// }

function cartesianProduct<T>(...allEntries: T[][]): T[][] {
  return allEntries.reduce<T[][]>(
    (results, entries) => {
      const newResults: T[][] = [];
      for (const result of results) {
        for (const entry of entries) {
          newResults.push([...result, entry]);
        }
      }
      return newResults;
    },
    [[]]
  );
}

/**
 * Compute the probability mass function of the combined payouts of a set of bets using the cartesian product.
 */
function computePayoutPMFCartesian(bets: PositionModel[]): PMF {
  const outcomes = cartesianProduct(
    ...bets.map((bet) => [
      { payout: 0, probability: 1 - bet.probability },
      { payout: bet.payout, probability: bet.probability },
    ])
  );

  const outcomeProbsAndPayouts = outcomes.map((outcome) => {
    const probability = outcome.reduce(
      (acc, betOutcome) => acc * betOutcome.probability,
      1
    );
    const payout = outcome.reduce(
      (acc, betOutcome) => acc + betOutcome.payout,
      0
    );
    return { probability, payout };
  });

  const combinedDistribution: PMF = new Map<number, number>();
  for (const outcome of outcomeProbsAndPayouts) {
    combinedDistribution.set(
      outcome.payout,
      (combinedDistribution.get(outcome.payout) || 0) + outcome.probability
    );
  }

  return combinedDistribution;
}

/**
 * Compute the probability mass function of the combined payouts of a set of bets using a Monte Carlo method.
 */
function computePayoutPMFMonteCarlo(
  bets: PositionModel[],
  samples: number
): PMF {
  const seed = 1; // or any number of your choice
  const rng = seedrandom(seed.toString()); // seedrandom is a seeded random number generator library

  const sampleOutcomes: number[] = [];

  for (let i = 0; i < samples; i++) {
    let samplePayout = 0;
    for (const bet of bets) {
      const randomOutcome = rng();
      if (randomOutcome <= bet.probability) {
        samplePayout += bet.payout;
      }
    }
    sampleOutcomes.push(samplePayout);
  }

  // Count occurrences of each outcome
  const outcomeCounts: Map<number, number> = new Map();
  for (const outcome of sampleOutcomes) {
    const currentCount = outcomeCounts.get(outcome) || 0;
    outcomeCounts.set(outcome, currentCount + 1);
  }

  // Normalize counts to compute probabilities
  const outcomePMF: PMF = new Map();
  for (const [outcome, count] of outcomeCounts.entries()) {
    outcomePMF.set(outcome, count / samples);
  }

  return outcomePMF;
}

/**
 * Given a set of individual bets, compute the probability mass function of the payouts.
 */
export function computePayoutDistribution(
  bets: PositionModel[],
  method: "cartesian" | "monte-carlo" = "cartesian",
  samples = mcSampleSize
): Map<number, number> {
  // FIXME currently this assumes outcomes of multiple choice and free response markets are independent,
  // whereas usually they are mutually exclusive

  if (method === "monte-carlo") {
    return computePayoutPMFMonteCarlo(bets, samples);
  } else {
    return computePayoutPMFCartesian(bets);
  }
}

export function computeExpectedValue(pmf: Map<number, number>): number {
  let expectedValue = 0;
  for (const [payout, prob] of Array.from(pmf.entries())) {
    expectedValue += payout * prob;
  }
  return expectedValue;
}

/**
 * Given a set of individual bets, compute the cumulative distribution (CDF) of the payouts (see above for how the
 * CDF data structure is defined). Use the cartesian product to do this.
 */
function computeCumulativeDistributionCartesian(
  bets: PositionModel[]
): Map<number, number> {
  const outcomes = cartesianProduct(
    ...bets.map((bet) => [
      { payout: 0, probability: 1 - bet.probability },
      { payout: bet.payout, probability: bet.probability },
    ])
  );

  const outcomeProbsAndPayouts = outcomes.map((outcome) => {
    const probability = outcome.reduce(
      (acc, betOutcome) => acc * betOutcome.probability,
      1
    );
    const payout = outcome.reduce(
      (acc, betOutcome) => acc + betOutcome.payout,
      0
    );
    return { probability, payout };
  });

  outcomeProbsAndPayouts.sort((a, b) => a.payout - b.payout);

  const cumulativeDistribution = new Map<number, number>();
  let cumulativeProb = 0;
  for (const outcome of outcomeProbsAndPayouts) {
    cumulativeProb += outcome.probability;
    cumulativeDistribution.set(outcome.payout, cumulativeProb);
  }

  return cumulativeDistribution;
}

/**
 * Given a set of individual bets, compute the cumulative distribution of the payouts.
 */
export function computeCumulativeDistribution(
  bets: PositionModel[],
  method: "convolution" | "cartesian" = "cartesian"
): CDF {
  if (method === "convolution") {
    throw new Error("Not implemented");
    // return computeCumulativeDistributionConvolution(bets);
  } else {
    return computeCumulativeDistributionCartesian(bets);
  }
}

/**
 * Given a function of a single variable, treat this as a random variable drawn from the given pmf.
 * Integrate over the pmf to find the expected value of the function.
 */
export function integrateOverPmf(f: UnivariateFunction, pmf: PMF): number {
  let result = 0;
  for (const [payout, prob] of Array.from(pmf.entries())) {
    result += f(payout) * prob;
  }
  return result;
}
