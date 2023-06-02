function convolveDistributions(
  dist1: Map<number, number>,
  dist2: Map<number, number>
): Map<number, number> {
  const result = new Map<number, number>();

  for (const [payout1, prob1] of Array.from(dist1.entries())) {
    for (const [payout2, prob2] of Array.from(dist2.entries())) {
      const combinedPayout = payout1 + payout2;
      const combinedProb = prob1 * prob2;

      result.set(
        combinedPayout,
        (result.get(combinedPayout) || 0) + combinedProb
      );
    }
  }

  return result;
}

// TODO combine with other binary search function
function binarySearch(arr: number[], target: number): number {
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) {
      return mid;
    } else if (arr[mid] < target) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return left;
}

export function cartesianProduct<T>(...allEntries: T[][]): T[][] {
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

// Main functions
export type BetModel = {
  probability: number;
  payout: number;
};

function computePayoutDistributionCartesian(
  bets: BetModel[]
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

  const combinedDistribution = new Map<number, number>();
  for (const outcome of outcomeProbsAndPayouts) {
    combinedDistribution.set(
      outcome.payout,
      (combinedDistribution.get(outcome.payout) || 0) + outcome.probability
    );
  }

  return combinedDistribution;
}

function computePayoutDistributionConv(bets: BetModel[]): Map<number, number> {
  let combinedDistribution = new Map<number, number>([[0, 1]]);

  for (const bet of bets) {
    const betDistribution = new Map<number, number>([
      [0, 1 - bet.probability],
      [bet.payout, bet.probability],
    ]);
    combinedDistribution = convolveDistributions(
      combinedDistribution,
      betDistribution
    );
  }

  return combinedDistribution;
}

export function computePayoutDistribution(
  bets: BetModel[],
  method: "convolution" | "cartesian" = "convolution"
): Map<number, number> {
  if (method === "convolution") {
    return computePayoutDistributionConv(bets);
  } else {
    return computePayoutDistributionCartesian(bets);
  }
}

export function computeExpectedValue(pmf: Map<number, number>): number {
  let expectedValue = 0;
  for (const [payout, prob] of Array.from(pmf.entries())) {
    expectedValue += payout * prob;
  }
  return expectedValue;
}

function computeCumulativeDistributionCartesian(
  bets: BetModel[]
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

// H(z) = sum over all PAYOUTS of the new bet F(z - payout) * f(payout)
// There are only two possible outcomes for the new bet: 0 and payout
// so this sum is H(z) = F(z) * (1 - p) + F(z - payout) * p
// we then want to precompute all possible values of this
// Given the current distinct values of F(z), the new distinct values are F(z) and F(z + payout)

// I think I don't actually need the convolution version
// function computeCumulativeDistributionConvolution(
//   bets: BetModel[]
// ): Map<number, number> {
//   let cumulativeDistribution = new Map<number, number>();
//   cumulativeDistribution.set(0, 1);

//   for (const bet of bets) {
//     const newCumulativeDistribution = new Map<number, number>();

//     for (const [payout1, prob1] of Array.from(
//       cumulativeDistribution.entries()
//     )) {
//       const combinedPayout1 = payout1 + bet.payout;
//       const combinedProb1 = prob1 * bet.probability;

//       newCumulativeDistribution.set(
//         combinedPayout1,
//         (newCumulativeDistribution.get(combinedPayout1) || 0) + combinedProb1
//       );

//       const combinedProb2 = prob1 * (1 - bet.probability);
//       newCumulativeDistribution.set(
//         payout1,
//         (newCumulativeDistribution.get(payout1) || 0) + combinedProb2
//       );
//     }

//     cumulativeDistribution = newCumulativeDistribution;
//   }

//   return cumulativeDistribution;
// }

export function computeCumulativeDistribution(
  bets: BetModel[],
  method: "convolution" | "cartesian" = "cartesian"
): Map<number, number> {
  if (method === "convolution") {
    throw new Error("Not implemented");
    // return computeCumulativeDistributionConvolution(bets);
  } else {
    return computeCumulativeDistributionCartesian(bets);
  }
}

function sampleFromCumulativeDistribution(
  cumulativeDistribution: Map<number, number>,
  targetProb: number
): number {
  const sortedPayouts = Array.from(cumulativeDistribution.keys()).sort(
    (a, b) => a - b
  );
  const cumulativeProbs = sortedPayouts.map(
    (payout) => cumulativeDistribution.get(payout) || 0
  );

  const index = binarySearch(cumulativeProbs, targetProb);
  return sortedPayouts[index];
}
