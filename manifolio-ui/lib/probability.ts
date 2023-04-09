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

// function approximateICDF(
//   bets: BetModel[],
//   targetProb: number,
//   numBins: number,
//   payoutLowerBound: number,
//   payoutUpperBound: number
// ): number {
//   // Calculate the discretized probability distributions for each bet
//   const betDistributions = bets.map((bet) => {
//     const dist = new Map<number, number>();

//     dist.set(0, 1 - bet.probability);
//     dist.set(bet.payout, bet.probability);

//     return dist;
//   });

//   // Calculate the combined distribution using convolutions
//   let combinedDistribution = betDistributions[0];

//   for (let i = 1; i < bets.length; i++) {
//     combinedDistribution = convolveDistributions(
//       combinedDistribution,
//       betDistributions[i]
//     );
//   }

//   // Calculate the cumulative probabilities
//   const cumulativeProbabilities: { payout: number; prob: number }[] = [];
//   let cumulativeProb = 0;

//   for (const [payout, prob] of Array.from(combinedDistribution.entries())) {
//     cumulativeProb += prob;
//     cumulativeProbabilities.push({ payout, prob: cumulativeProb });
//   }

//   cumulativeProbabilities.sort((a, b) => a.payout - b.payout);

//   // Find the payout corresponding to the target probability
//   const index = binarySearch(
//     cumulativeProbabilities.map((x) => x.prob),
//     targetProb
//   );

//   return cumulativeProbabilities[index].payout;
// }

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

export function computeICDF(bets: BetModel[], targetProb: number): number {
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

  const cumulativeProbs = outcomeProbsAndPayouts.reduce<number[]>(
    (acc, outcome) => {
      const lastProb = acc.length > 0 ? acc[acc.length - 1] : 0;
      acc.push(lastProb + outcome.probability);
      return acc;
    },
    []
  );

  const index = binarySearch(cumulativeProbs, targetProb);
  return outcomeProbsAndPayouts[index].payout;
}

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

export function computePayoutDistributionConv(
  bets: BetModel[]
): Map<number, number> {
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

export function computeExpectedValue(dist: Map<number, number>): number {
  let expectedValue = 0;
  for (const [payout, prob] of Array.from(dist.entries())) {
    expectedValue += payout * prob;
  }
  return expectedValue;
}

// Example usage
// const bets: Bet[] = [
//   { probability: 0.5, payout: 2 },
//   { probability: 0.4, payout: 3 },
// ];

// const targetProb = 0.6;
// const icdfValue = computeICDF(bets, targetProb);
// console.log(`ICDF(${targetProb}) = ${icdfValue}`);
